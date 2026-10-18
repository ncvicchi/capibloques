"""Add ONLY dev1/dev2 vhosts to the existing edge. Explicit operator command.

Copy this directory and ../public-dev/{render_edge.py,edge-*.conf.template}
to the edge preserving layout. DNS belongs to the owner. No gateway changes.
"""
import argparse
import fcntl
import importlib.util
import ipaddress
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time


def run(*args, capture=False):
    return subprocess.run([str(a) for a in args], check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=('http', 'https'))
    parser.add_argument('--acme-root', required=True)
    parser.add_argument('--http-port', type=int, default=80)
    parser.add_argument('--https-port', type=int, default=8443)
    args = parser.parse_args()
    if os.getuid() != 0:
        parser.error('Requiere sudo en la VM Nginx, NO en Proxmox ni en capi-dev.')
    lock = open('/run/capibloques-edge-environments.lock', 'a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError('Edge ocupado: otra instalación de dev1/dev2 sigue activa.') from None
    addresses = run('ip', '-4', '-o', 'addr', 'show', capture=True)
    # Compare the address token, not substring matches (38 vs 138).
    found = {str(ipaddress.ip_interface(word).ip) for word in addresses.split() if '/' in word and word[0].isdigit()}
    if '192.168.1.38' not in found:
        parser.error('Esta operación sólo admite la VM edge 192.168.1.38.')
    renderer = Path(__file__).resolve().parent.parent/'public-dev/render_edge.py'
    spec = importlib.util.spec_from_file_location('edge_renderer', renderer)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    acme = module.absolute_path(args.acme_root)
    if not Path(acme).is_dir():
        parser.error('La raíz ACME existente debe ser un directorio; no se crea ni cambia otra configuración.')
    if not all(1 <= port <= 65535 for port in (args.http_port, args.https_port)):
        parser.error('Puerto inválido.')
    run('nginx', '-t')  # Refuse to take responsibility for pre-existing errors.
    current_file = ''
    for line in run('nginx', '-T', capture=True).splitlines():
        if line.startswith('# configuration file '):
            current_file = line.removeprefix('# configuration file ').rstrip(':')
        if line.strip().startswith('server_name '):
            for number in (1, 2):
                allowed = {f'/etc/nginx/sites-enabled/zz-capibloques-dev{number}.conf',
                           f'/etc/nginx/conf.d/capibloques-dev{number}.conf'}
                if f'capibloques.dev{number}.nvicchi.com' in line and current_file not in allowed:
                    raise RuntimeError('Ya existe ese dominio en otro archivo: '+current_file)
    with tempfile.TemporaryDirectory(prefix='capibloques-edge-') as temporary:
        candidates = []
        for number in (1, 2):
            fqdn = f'capibloques.dev{number}.nvicchi.com'
            output = Path(temporary)/f'capibloques-dev{number}.conf'
            command = ['python3', str(renderer), args.stage, '--fqdn', fqdn, '--acme-root', acme,
                       '--http-port', str(args.http_port), '--https-port', str(args.https_port), '--output', str(output)]
            if args.stage == 'https':
                certificate = Path('/etc/letsencrypt/live')/fqdn/'fullchain.pem'
                key = certificate.parent/'privkey.pem'
                if not key.is_file():
                    raise RuntimeError('Falta certificado propio de '+fqdn+'; instalar HTTP y emitirlo primero.')
                run('openssl', 'x509', '-in', certificate, '-noout', '-checkhost', fqdn, '-checkend', '86400')
                command += ['--upstream', f'192.168.1.77:{3080+number}', '--certificate', str(certificate), '--certificate-key', str(key)]
            run(*command)
            content = output.read_bytes()
            # conf.d is loaded BEFORE existing sites: a new first listener
            # would accidentally become the default TLS vhost. Append only
            # our zz- sites, preserving existing default servers/protocol order.
            candidates.append((Path('/etc/nginx/sites-enabled')/('zz-'+output.name), content))
            legacy = Path('/etc/nginx/conf.d')/output.name
            if legacy.exists():
                if legacy.is_symlink() or legacy.read_bytes() != content:
                    raise RuntimeError('Revisar el vhost anterior modificado; no se moverá: '+str(legacy))
                candidates.append((legacy, None))
        # Back up/restore only our two exact files. Never change unrelated
        # certificates, vhosts, default server, gateway, router or PRD.
        backups = {}
        backup_root = Path('/var/backups/capibloques-edge')/str(time.time_ns())
        backup_root.mkdir(parents=True, mode=0o700)
        for path, _ in candidates:
            if path.is_symlink():
                raise RuntimeError('No se reemplazará un enlace existente: '+str(path))
            backups[path] = path.read_bytes() if path.exists() else None
            if path.exists():
                shutil.copy2(path, backup_root/path.name)
        try:
            for path, content in candidates:
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)
                    os.chmod(path, 0o644)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        except Exception:
            for path, content in backups.items():
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
            raise
    print('LISTO: sólo dev1/dev2, etapa '+args.stage+'. Main y certificados ajenos intactos.')
    if args.stage == 'http':
        for number in (1, 2):
            fqdn = f'capibloques.dev{number}.nvicchi.com'
            print(f'Emitir certificado independiente: sudo certbot certonly --non-interactive --webroot -w {acme} --cert-name {fqdn} -d {fqdn}')
        print('Con certificados emitidos, repetir con https y los mismos puertos/raíz ACME.')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'ERROR: {error}') from None
