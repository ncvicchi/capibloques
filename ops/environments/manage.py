"""DEV siblings only. Never change main's Compose, database, checkout or vhost.

Run via update-dev.sh (its user-level flock serializes all Git/publication).
Root owns service configuration; Git always runs as capi. No volume deletion.
"""
import argparse
import fcntl
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request

REPO = Path('/home/capi/capibloques')
BASE = Path('/etc/capibloques/environments')
DATA = Path('/var/lib/capibloques-environments')
RELEASES = Path('/home/capi/capibloques-envs')
RUNNER = Path('/opt/capibloques-compiler/runner.py')
FIREWALL_TEMPLATE = Path('/opt/capibloques-environments/firewall-template.sh')
PROFILES = ('wemos-d1-r32', 'diymall-esp32-s3-devkitc-v1-n16r8', 'waveshare-esp32-s3-touch-lcd-5-28117')


def run(*args, capture=False, data=None, cwd=None):
    return subprocess.run([str(a) for a in args], check=True, text=True, input=data,
                          stdout=subprocess.PIPE if capture else None, cwd=cwd).stdout


def git(*args):
    return run('sudo', '-H', '-u', 'capi', '--', 'git', '-C', REPO, *args, capture=True).strip()


def atomic(path, value, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.new')
    tmp.write_text(value, encoding='utf-8')
    os.chmod(tmp, mode)
    tmp.replace(path)


def layout(env):
    if env not in ('dev1', 'dev2'):
        raise ValueError('Sólo dev1/dev2; main conserva su runtime actual.')
    n = int(env[-1])
    return dict(env=env, project=f'capibloques-{env}', fqdn=f'capibloques.{env}.nvicchi.com',
                local=3000+n, port=3080+n, subnet=f'172.30.{13+n}.0/29',
                web=f'172.30.{13+n}.2', api=f'172.30.{13+n}.3',
                directory=BASE/env, data=DATA/env)


def compose(spec, *args, config=None, capture=False, data=None):
    return run('docker', 'compose', '--ansi', 'never', '-p', spec['project'], '-f',
               config or spec['directory']/'compose.json', *args, capture=capture, data=data)


def manage(spec, *args, config=None, capture=False, data=None):
    return compose(spec, 'exec', '-T', 'api', 'python', 'manage.py', *args,
                   config=config, capture=capture, data=data)


def resource_lock():
    handle = open('/run/capibloques-build.lock', 'a')
    started = time.monotonic()
    while True:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            break
        except BlockingIOError:
            if time.monotonic()-started > 900:
                raise RuntimeError('Hay una compilación activa. Repetí al terminar; no se inició otra.')
            print('Esperando el recurso de construcción compartido (sin ETA fiable)…', flush=True)
            time.sleep(30)
    if run('docker', 'ps', '-q', '--filter', 'label=com.capibloques.compiler=1', capture=True).strip():
        handle.close()
        raise RuntimeError('Quedó un compilador activo sin su bloqueo; requiere reconciliación del runner.')
    return handle


def main_manage(code):
    return run('docker', 'compose', '-f', REPO/'compose.dev.yaml', '-f', REPO/'compose.backend.dev.yaml',
               'exec', '-T', 'api', 'python', 'manage.py', 'shell', '-c', code, capture=True, cwd=REPO).strip().splitlines()[-1]


def install(source):
    """Only scheduler upgraded in main, drained first; HTTP/data remain untouched."""
    if Path('/var/lib/capibloques/dev-deploy.state').exists():
        raise RuntimeError('Hay mantenimiento main pendiente; resolverlo antes de instalar ambientes.')
    paused = main_manage('from compiler.models import CompilerConfig; print(int(CompilerConfig.objects.get(pk=1).paused))')
    if paused not in ('0', '1'):
        raise RuntimeError('No se pudo leer la admisión original de main.')
    def pause(value):
        main_manage('from accounts.models import access_lock; from compiler.models import CompilerConfig,CompilerEvent; '
                    'from compiler.views import settings_record\n'
                    'with access_lock():\n c=CompilerConfig.objects.select_for_update().get(pk=1); '
                    'before=settings_record(c)\n'
                    f' if c.paused != bool({value}):\n  c.paused=bool({value}); c.revision+=1; c.save(); '
                    'CompilerEvent.objects.create(actor_id_snapshot=None,before=before,after=settings_record(c))\nprint("ok")')
    was_active = run('systemctl', 'show', 'capibloques-compiler.service', '-p', 'ActiveState', '--value', capture=True).strip() == 'active'
    pause(1)
    try:
        deadline = time.monotonic()+900
        while main_manage('from compiler.models import Build; print(Build.objects.filter(state="building").count())') != '0':
            if time.monotonic() > deadline:
                raise RuntimeError('Main sigue compilando; instalación no realizada.')
            print('Esperando que termine la compilación de main…', flush=True)
            time.sleep(10)
        run('systemctl', 'stop', 'capibloques-compiler.service')
        with resource_lock():
            # A single compatible runner isolates queues and shares the physical
            # build slot. Keep the old root copy as recovery evidence.
            if RUNNER.exists():
                backup = RUNNER.with_name('runner.before-environments.py')
                if not backup.exists():
                    shutil.copy2(RUNNER, backup)
            atomic(RUNNER, (source/'ops/compiler/runner.py').read_text(), 0o644)
            target = Path('/opt/capibloques-environments')
            target.mkdir(parents=True, exist_ok=True)
            atomic(target/'manage.py', Path(__file__).read_text(), 0o644)
            atomic(target/'runner.py', (source/'ops/compiler/runner.py').read_text(), 0o644)
            atomic(target/'compiler.Dockerfile', (source/'ops/environments/compiler.Dockerfile').read_text(), 0o644)
            atomic(FIREWALL_TEMPLATE, (source/'ops/public-dev/firewall.sh').read_text(), 0o644)
            for env in ('dev1', 'dev2'):
                spec = layout(env)
                unit = ('[Unit]\nDescription=CapiBloques '+env+' aislado\nRequires=docker.service\nAfter=docker.service network-online.target\n'
                        '[Service]\nType=oneshot\nRemainAfterExit=yes\n'
                        f'ExecStart=/usr/bin/python3 /opt/capibloques-environments/manage.py start {env}\n'
                        f'ExecStop=/usr/bin/python3 /opt/capibloques-environments/manage.py stop {env}\n'
                        'TimeoutStartSec=180\nTimeoutStopSec=90\n[Install]\nWantedBy=multi-user.target\n')
                atomic(Path(f'/etc/systemd/system/capibloques-{env}.service'), unit, 0o644)
                compiler_unit = ('[Unit]\nDescription=Cola compilador '+env+'\nAfter=capibloques-'+env+'.service\n'
                                 '[Service]\nEnvironment=CAPIBLOQUES_COMPILER_ENV='+env+'\n'
                                 'ExecStart=/usr/bin/python3 /opt/capibloques-compiler/runner.py\nRestart=on-failure\nRestartSec=10\n'
                                 'UMask=0077\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=full\nMemoryMax=128M\nTasksMax=32\n'
                                 '[Install]\nWantedBy=multi-user.target\n')
                atomic(Path(f'/etc/systemd/system/capibloques-compiler-{env}.service'), compiler_unit, 0o644)
            run('systemctl', 'daemon-reload')
    finally:
        try:
            if was_active:
                run('systemctl', 'start', 'capibloques-compiler.service')
        finally:
            pause(paused)
    print('Instalación preparada. Main conserva web, base y endpoint. Dev1/dev2 se crean al actualizarlos.')


def settings(spec):
    # Read only exact public addresses; never copy main secrets/session keys.
    original = dict(line.split('=', 1) for line in Path('/etc/capibloques/public-dev.env').read_text().splitlines()
                    if line and not line.startswith('#') and '=' in line)
    edge = str(ipaddress.IPv4Address(original['CAPIBLOQUES_EDGE_IP']))
    bind = str(ipaddress.IPv4Address(original['CAPIBLOQUES_PUBLIC_BIND_IP']))
    if not ipaddress.ip_address(bind).is_private or not ipaddress.ip_address(edge).is_private:
        raise ValueError('Se requieren IP LAN privadas.')
    return dict(CAPIBLOQUES_EDGE_IP=edge, CAPIBLOQUES_PUBLIC_BIND_IP=bind,
                CAPIBLOQUES_PUBLIC_PORT=str(spec['port']), CAPIBLOQUES_LOCAL_PORT=str(spec['local']),
                CAPIBLOQUES_LOCAL_BIND_IP='127.0.0.1', CAPIBLOQUES_PROXY_SUBNET=spec['subnet'],
                CAPIBLOQUES_WEB_PROXY_IP=spec['web'], CAPIBLOQUES_API_PROXY_IP=spec['api'],
                CAPIBLOQUES_SECRETS_DIR=str(spec['directory']/'secrets'),
                CAPIBLOQUES_ALLOWED_HOSTS=spec['fqdn'],
                CAPIBLOQUES_CSRF_TRUSTED_ORIGINS='https://'+spec['fqdn'],
                CAPIBLOQUES_TRUSTED_PROXY_IPS=spec['web']+','+edge,
                CAPIBLOQUES_SECURE_COOKIES='true')


def create_config(spec, release, commit):
    values = settings(spec)
    values.update(CAPIBLOQUES_BUILD_REVISION=commit, CAPIBLOQUES_WEB_IMAGE_TAG=commit[:12])
    envfile = spec['directory']/'settings.env'
    atomic(envfile, ''.join(f'{key}={value}\n' for key, value in values.items()))
    directory = spec['directory']/'secrets'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    for key in ('django_key', 'db_admin_password', 'db_app_password'):
        path = directory/key
        if not path.exists():
            volumes = run('docker', 'volume', 'ls', '--format', '{{.Name}}', capture=True).splitlines()
            if spec['project']+'_pgdata' in volumes or (spec['directory']/'compose.json').exists():
                raise RuntimeError('Falta un secreto de una base existente; restaurarlo, NO regenerarlo.')
            # Compose file secrets are bind mounts: uid/gid/mode remapping is
            # NOT implemented. PostgreSQL uid999 and API uid1000 both need the
            # app credential. Protect host traversal with root-only directories,
            # mount individual files read-only, and never grant a container the
            # source directory. No credentials in argv/environment or images.
            atomic(path, secrets.token_urlsafe(64), 0o444)
    artifacts = spec['data']/'artifacts'
    artifacts.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chown(artifacts, 1000, 1000)
    config = json.loads(run('docker', 'compose', '--env-file', envfile, '-p', spec['project'],
                            '-f', release/'compose.dev.yaml', '-f', release/'compose.backend.dev.yaml',
                            'config', '--format', 'json', capture=True))
    config['name'] = spec['project']
    api, db, editor = (config['services'][key] for key in ('api', 'db', 'editor'))
    for key, service in (('api', api), ('editor', editor)):
        service['image'] = f'capibloques-{key}-{spec["env"]}:{commit[:12]}'
    # Immutable code from COPY in Dockerfile, not a changing checkout bind.
    api['volumes'] = [dict(type='bind', source=str(artifacts), target='/artifacts', read_only=True)]
    api['restart'] = 'unless-stopped'
    db['mem_limit'] = 134217728
    db['memswap_limit'] = 201326592
    config['volumes']['pgdata']['name'] = spec['project']+'_pgdata'
    # Keep all names scoped even if input files accidentally declare main names.
    for key, network in config.get('networks', {}).items():
        network['name'] = spec['project']+'_'+key
    result = spec['directory']/'candidate.json'
    atomic(result, json.dumps(config, indent=2))
    compose(spec, 'config', '--quiet', config=result)
    firewall = FIREWALL_TEMPLATE.read_text().replace('CHAIN=CAPIBLOQUES_DEV_IN', f'CHAIN=CAPIBLOQUES_{spec["env"].upper()}_IN')
    firewall = firewall.replace('/etc/capibloques/public-dev.env', str(envfile))
    firewall = firewall.replace('project=capibloques-dev', 'project='+spec['project'])
    firewall = firewall.replace('/run/capibloques-dev-firewall', '/run/capibloques-'+spec['env']+'-firewall')
    if 'CHAIN=CAPIBLOQUES_DEV_IN\n' in firewall or 'project=capibloques-dev\n' in firewall or '/etc/capibloques/public-dev.env' in firewall:
        raise RuntimeError('La plantilla del firewall no se pudo aislar; no se instalará.')
    atomic(spec['directory']/'firewall.sh', firewall, 0o700)
    return result


def firmware(release, commit):
    # A sibling may be older: derive its own version, never relabel its binary.
    versions = re.findall(r'^#define CAPI_FIRMWARE_VERSION "([0-9]+\.[0-9]+\.[0-9]+)"$', (release/'interpreter/main/main.cpp').read_text(), re.MULTILINE)
    if len(versions) != 1:
        raise RuntimeError('No se pudo determinar la versión del intérprete de la release.')
    version = versions[0]
    revision = git('rev-parse', commit+':interpreter')
    destination = release/'public/interpreter'
    destination.mkdir(parents=True, exist_ok=True)
    os.chown(destination, 1000, 1000)
    def valid(root):
        try:
            for profile in PROFILES:
                info = json.loads((root/(profile+'.json')).read_text())
                bundle = root/info['bundle']
                assert bundle.parent == root and info['sourceRevision'] == revision and info['version'] == version
                assert bundle.stat().st_size == info['bytes']
                assert hashlib.sha256(bundle.read_bytes()).hexdigest() == info['sha256']
            return True
        except (OSError, ValueError, KeyError, AssertionError):
            return False
    if valid(destination):
        return
    if valid(REPO/'public/interpreter'):
        for profile in PROFILES:
            info = json.loads((REPO/'public/interpreter'/(profile+'.json')).read_text())
            for filename in (profile+'.json', info['bundle']):
                shutil.copy2(REPO/'public/interpreter'/filename, destination/filename)
        return
    cache = RELEASES/'interpreter-cache'
    cache.mkdir(parents=True, exist_ok=True)
    os.chown(cache, 1000, 1000)
    image = run('docker', 'image', 'inspect', 'capibloques-compiler-dev:phase9', '--format', '{{.Id}}', capture=True).strip()
    run('docker', 'run', '--rm', '--cpus', '1', '--memory', '1200m', '--memory-swap', '1500m',
        '--entrypoint', '/bin/bash', '--user', '1000:1000', '-e', 'HOME=/tmp/capi-idf', '-e', 'IDF_PY_BUILD_JOBS=2',
        '-e', 'CAPI_INTERPRETER_TOOLCHAIN_KEY='+image, '-v', str(release)+':/project',
        '-v', str(cache)+':/project/outputs', '-w', '/project', image,
        '-lc', '. "$IDF_PATH/export.sh" >/dev/null && bash scripts/build-interpreter-firmware.sh '+version+' /project/public/interpreter '+revision)
    if not valid(destination):
        raise RuntimeError('Firmware incompleto o de otra revisión; no se publicará.')


def verify_published_firmware(spec, release, commit):
    """Health/revision alone cannot detect a mislabeled interpreter bundle."""
    versions = re.findall(r'^#define CAPI_FIRMWARE_VERSION "([0-9]+\.[0-9]+\.[0-9]+)"$', (release/'interpreter/main/main.cpp').read_text(), re.MULTILINE)
    if len(versions) != 1:
        raise RuntimeError('No se pudo determinar la versión de firmware publicada.')
    version = versions[0]
    revision = git('rev-parse', commit+':interpreter')
    for profile in PROFILES:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{spec["local"]}/interpreter/{profile}.json', timeout=10) as response:
                info = json.load(response)
            if not isinstance(info, dict):
                raise ValueError('Manifiesto inválido')
            if (info.get('board') != profile or info.get('version') != version or
                    info.get('abi') != 1 or info.get('sourceRevision') != revision):
                raise ValueError(f'esperado {version}, publicado {info.get("version", "desconocido")}')
        except (OSError, ValueError, KeyError) as error:
            raise RuntimeError(f'Firmware publicado incompatible para {profile}: {error}. No se confirma la actualización.') from None


def healthy(spec):
    deadline = time.monotonic()+120
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{spec["local"]}/api/health/ready/', timeout=5) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(2)
    raise RuntimeError('El ambiente no quedó saludable; no se registra como probado.')


def verify_active(spec, commit):
    configuration = json.loads((spec['directory']/'compose.json').read_text())
    for service in ('editor', 'api'):
        ids = compose(spec, 'ps', '-q', service, capture=True).split()
        if len(ids) != 1:
            raise RuntimeError('No hay exactamente un '+service+' activo.')
        detail = json.loads(run('docker', 'inspect', ids[0], capture=True))[0]
        expected = configuration['services'][service]['image']
        image = run('docker', 'image', 'inspect', expected, '--format', '{{.Id}}', capture=True).strip()
        if not detail['State']['Running'] or detail['Config']['Image'] != expected or detail['Image'] != image:
            raise RuntimeError('La imagen activa no es la instalada: '+service)
        if service == 'editor' and detail['Config']['Labels'].get('org.opencontainers.image.revision') != commit:
            raise RuntimeError('El editor no declara el commit instalado.')


def deploy(spec, commit):
    if not RUNNER.exists() or RUNNER.read_bytes() != Path('/opt/capibloques-environments/runner.py').read_bytes():
        raise RuntimeError('Primero ejecutá setup-environments.sh para instalar el runner compatible.')
    if git('rev-parse', f'origin/{spec["env"]}') != commit:
        raise ValueError('El objetivo no coincide con la rama del ambiente.')
    if git('rev-parse', commit+':ops/compiler/runner.py') != git('hash-object', str(RUNNER)):
        raise RuntimeError('La rama cambia el runner compartido; requiere setup explícito antes de actualizar.')
    pending = spec['directory']/'pending.json'
    if pending.exists() and json.loads(pending.read_text())['commit'] != commit:
        raise RuntimeError('Existe una actualización pendiente distinta; reintentar la misma revisión antes de avanzar.')
    release = RELEASES/spec['env']/commit
    release.parent.mkdir(parents=True, exist_ok=True)
    os.chown(RELEASES, 1000, 1000)
    os.chown(release.parent.parent, 1000, 1000)
    os.chown(release.parent, 1000, 1000)
    if not release.exists():
        git('worktree', 'add', '--detach', str(release), commit)
    if run('sudo', '-H', '-u', 'capi', '--', 'git', '-C', release, 'status', '--porcelain', capture=True).strip():
        raise RuntimeError('La release tiene cambios locales; se conserva sin sobrescribir.')
    spec['directory'].mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(spec['directory'], 0o700)
    # Refuse overlap with other Docker projects before publishing any port.
    networks = run('docker', 'network', 'ls', '-q', capture=True).split()
    for network in networks:
        info = json.loads(run('docker', 'network', 'inspect', network, capture=True))[0]
        if info.get('Labels', {}).get('com.docker.compose.project') == spec['project']:
            continue
        for item in info.get('IPAM', {}).get('Config') or []:
            subnet = item.get('Subnet')
            if subnet and ipaddress.ip_network(subnet).version == 4 and ipaddress.ip_network(subnet).overlaps(ipaddress.ip_network(spec['subnet'])):
                raise RuntimeError('La subred del ambiente colisiona con otra red Docker.')
    if shutil.disk_usage('/').free < 4*1024**3:
        raise RuntimeError('Se requieren al menos 4 GiB libres; no se borrará ninguna caché para continuar.')
    with resource_lock():
        firmware(release, commit)
        candidate = create_config(spec, release, commit)
        compose(spec, 'build', 'api', 'editor', config=candidate)
        # The large SDK image is shared; only branch generator sources overlay it.
        for path in ('ops/compiler/Dockerfile', 'ops/compiler/generator/package-lock.json', 'ops/compiler/generator/package.json', 'ops/compiler/arduino-cli.yaml'):
            if git('rev-parse', commit+':'+path) != git('rev-parse', 'HEAD:'+path):
                raise RuntimeError('Cambió la toolchain; requiere instalación explícita, no se reutilizará una receta distinta.')
        image_tag = f'capibloques-compiler-{spec["env"]}:{commit[:12]}'
        # Compose uses its embedded BuildKit client even on this VM without
        # buildx. Plain `docker build` falls back to the legacy builder, which
        # re-exports the huge SDK parent at every COPY (minutes per tiny file).
        compiler_config = spec['directory']/'compiler-build.json'
        atomic(compiler_config, json.dumps(dict(name=spec['project'], services={
            'compiler-image': dict(image=image_tag, build=dict(context=str(release),
                dockerfile='/opt/capibloques-environments/compiler.Dockerfile',
                args=dict(CAPI_COMPILER_BASE='capibloques-compiler-dev:phase9')))})))
        compose(spec, 'build', 'compiler-image', config=compiler_config)
        image = run('docker', 'image', 'inspect', image_tag, '--format', '{{.Id}}', capture=True).strip()
        # The CURRENT main cleanup predates environments. A stopped, scoped pin
        # protects this idle recipe even before the new cleanup reaches main;
        # docker image rm (without force) cannot remove a referenced image.
        pin_name = f'capibloques-{spec["env"]}-recipe-{commit[:12]}'
        pins = run('docker', 'ps', '-aq', '--filter', 'name=^/'+pin_name+'$', capture=True).strip()
        if not pins:
            run('docker', 'create', '--name', pin_name, '--network', 'none', '--read-only',
                '--label', 'com.capibloques.recipe-pin='+spec['env'], image)
        previous = spec['directory']/'compose.json'
        if previous.exists():
            try:
                jobs = json.loads(manage(spec, 'compiler_dispatch', 'inspect', capture=True))
                if jobs['active']:
                    raise RuntimeError('El ambiente tiene intentos pendientes de reconciliación; no se recreará su API.')
            except subprocess.CalledProcessError:
                if not pending.exists():
                    raise  # Only our own interrupted, previously drained update.
            run('systemctl', 'stop', f'capibloques-compiler-{spec["env"]}.service')
        compose(spec, 'up', '-d', '--wait', 'db', config=candidate)
        backups = spec['data']/'backups'
        backups.mkdir(parents=True, exist_ok=True, mode=0o700)
        backup = backups/f'pre-{commit}.dump'
        if not pending.exists():
            # pg_dump is binary: never decode or place secrets on argv.
            with backup.open('wb') as output:
                subprocess.run(['docker', 'compose', '-p', spec['project'], '-f', str(candidate), 'exec', '-T', 'db',
                                'pg_dump', '-U', 'postgres', '-Fc', 'capibloques'], stdout=output, check=True)
            with backup.open('rb') as source:
                subprocess.run(['docker', 'compose', '-p', spec['project'], '-f', str(candidate), 'exec', '-T', 'db',
                                'pg_restore', '--list'], stdin=source, stdout=subprocess.DEVNULL, check=True)
            atomic(pending, json.dumps(dict(commit=commit, backup=str(backup))))
        # Stop only this environment. Never stop main editor/API/db.
        if previous.exists():
            compose(spec, 'stop', 'editor', 'api')
        run('bash', spec['directory']/'firewall.sh', 'apply')
        compose(spec, 'run', '--rm', '--no-deps', 'api', 'python', 'manage.py', 'migrate', '--noinput', config=candidate)
        if previous.exists():
            shutil.copy2(previous, spec['directory']/'previous-compose.json')
        atomic(previous, candidate.read_text())
        atomic(spec['directory']/'compiler.json', json.dumps(dict(checkout=str(release), compose=str(previous), image=image)))
        run('systemctl', 'enable', f'capibloques-{spec["env"]}.service')
        run('systemctl', 'restart', f'capibloques-{spec["env"]}.service')
        healthy(spec)
        verify_active(spec, commit)
        verify_published_firmware(spec, release, commit)
        manage(spec, 'compiler_dispatch', 'register', data=json.dumps(dict(recipe=image.removeprefix('sha256:'), ceiling=1)))
        run('systemctl', 'enable', '--now', f'capibloques-compiler-{spec["env"]}.service')
        atomic(spec['directory']/'deployed', commit+'\n', 0o644)
        pending.unlink()
        old_pins = run('docker', 'ps', '-aq', '--filter', 'label=com.capibloques.recipe-pin='+spec['env'], capture=True).split()
        for container in old_pins:
            info = json.loads(run('docker', 'inspect', container, capture=True))[0]
            if info['Name'] != '/'+pin_name and not info['State']['Running']:
                run('docker', 'rm', container)
    print(f'{spec["env"]}: {commit[:12]} saludable por loopback. URL: https://{spec["fqdn"]} (requiere DNS/TLS del edge).')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('install', 'deploy', 'deployed', 'start', 'stop', 'admin', 'main-update'))
    parser.add_argument('environment', nargs='?', choices=('dev1', 'dev2'))
    parser.add_argument('--commit')
    args = parser.parse_args()
    if os.getuid() != 0 or socket.gethostname() != 'capi-dev':
        parser.error('Sólo root en capi-dev, invocado por el actualizador como capi.')
    if args.action == 'install':
        install(Path(__file__).resolve().parents[2])
        return
    if args.action == 'main-update':
        if not args.commit or not re.fullmatch('[0-9a-f]{40}', args.commit):
            parser.error('Se requiere SHA completo.')
        if git('rev-parse', 'origin/main') != args.commit:
            raise ValueError('Main remoto cambió.')
        content = git('show', args.commit+':scripts/deploy-dev-remote.sh')
        # Old main scripts do not yet participate in the shared build guard.
        # New scripts acquire it themselves AFTER draining main's queue.
        if '/run/capibloques-build.lock' in content:
            raise RuntimeError('Este main ya soporta el bloqueo; usar su actualizador normal.')
        with resource_lock(), tempfile.NamedTemporaryFile(mode='w', suffix='.sh') as script:
            script.write(content+'\n'); script.flush()
            run('bash', script.name, '--expected-commit', args.commit)
        return
    if not args.environment:
        parser.error('Falta dev1 o dev2.')
    spec = layout(args.environment)
    if args.action == 'deploy':
        if not args.commit or not re.fullmatch('[0-9a-f]{40}', args.commit):
            parser.error('Se requiere SHA completo.')
        deploy(spec, args.commit)
    elif args.action == 'deployed':
        if (spec['directory']/'pending.json').exists():
            raise RuntimeError('Actualización incompleta: no se permite promover.')
        healthy(spec)
        commit = (spec['directory']/'deployed').read_text().strip()
        verify_active(spec, commit)
        print(commit)
    elif args.action == 'start':
        run('bash', spec['directory']/'firewall.sh', 'apply')
        compose(spec, 'up', '-d', '--wait', 'db', 'api', 'editor')
        healthy(spec)
    elif args.action == 'stop':
        compose(spec, 'stop', 'editor', 'api')
    elif args.action == 'admin':
        # Explicit interactive terminal: password is never an argument/file.
        run('docker', 'compose', '-p', spec['project'], '-f', spec['directory']/'compose.json',
            'exec', 'api', 'python', 'manage.py', 'bootstrap_admin')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'ERROR: {error}') from None
