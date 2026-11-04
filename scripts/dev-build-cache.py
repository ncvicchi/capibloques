#!/usr/bin/env python3
"""Content-addressed images shared by main/dev1/dev2. No service operations."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import subprocess
import tempfile
import time

RECIPES = {
    'editor': ('', 'ops/public-dev/Dockerfile'),
    'api': ('backend', 'Dockerfile'),
    'compiler': ('', 'ops/environments/compiler.Dockerfile'),
}
PROFILES = ('wemos-d1-r32', 'diymall-esp32-s3-devkitc-v1-n16r8', 'waveshare-esp32-s3-touch-lcd-5-28117')


def run(*args, capture=False):
    return subprocess.check_output(args, text=True).strip() if capture else subprocess.run(args, check=True)


def copy_sources(dockerfile):
    """Fail closed on new syntax rather than omit a future build dependency."""
    sources = []
    for line in dockerfile.replace('\\\n', ' ').splitlines():
        if not re.match(r'^\s*(COPY|ADD)\s', line, re.I):
            continue
        tokens = shlex.split(line.strip())
        if tokens[0].upper() != 'COPY' or '[' in tokens[1]:
            raise ValueError('Receta no soportada: revisar sus entradas COPY/ADD.')
        if any(token.startswith('--from=') for token in tokens):
            continue
        values = [token for token in tokens[1:] if not token.startswith('--')]
        if len(values) < 2:
            raise ValueError('COPY incompleto.')
        for value in values[:-1]:
            if '$' in value or '..' in PurePosixPath(value).parts or value.startswith('/'):
                raise ValueError('COPY debe referirse al contexto local.')
            sources.append(value.rstrip('/') or '.')
    return sources


def selected(path, sources):
    return any(source == '.' or path == source or path.startswith(source + '/') or
               fnmatch.fnmatchcase(path, source) for source in sources)


def inputs(root, kind, tracked=None):
    root = Path(root).resolve()
    prefix, recipe = RECIPES[kind]
    context = root / prefix
    recipe_path = context / recipe
    recipe_text = recipe_path.read_text(encoding='utf-8')
    sources = copy_sources(recipe_text)
    if tracked is None:
        command = ['git', '-C', str(root), 'ls-files', '-z']
        # Root must not create/update Git metadata in the operator's checkout.
        if hasattr(os, 'geteuid') and os.geteuid() == 0:
            command = ['sudo', '-H', '-u', 'capi', '--', *command]
        tracked = subprocess.check_output(command).decode().split('\0')
    files = {}
    for name in tracked:
        if not name or (prefix and not name.startswith(prefix + '/')):
            continue
        relative = name[len(prefix)+1:] if prefix else name
        if kind == 'editor' and relative.startswith('public/interpreter/'):
            continue  # Only current, validated bundles enter the web image.
        if selected(relative, sources):
            files[relative] = context / relative
    for source in sources:
        if not any(selected(name, [source]) for name in files) and source != 'public':
            raise ValueError('COPY sin archivos versionados: ' + source)
    if kind == 'editor':
        for profile in PROFILES:
            manifest = root / 'public/interpreter' / (profile + '.json')
            info = json.loads(manifest.read_text())
            bundle = manifest.parent / info['bundle']
            if bundle.parent != manifest.parent or bundle.is_symlink() or manifest.is_symlink():
                raise ValueError('Paquete fuera del directorio del intérprete.')
            data = bundle.read_bytes()
            if (info.get('board') != profile or len(data) != info['bytes'] or
                    hashlib.sha256(data).hexdigest() != info['sha256']):
                raise ValueError('Paquete del intérprete inválido: ' + profile)
            for path in (manifest, bundle):
                files[path.relative_to(context).as_posix()] = path
    files[recipe] = recipe_path
    for ignore in (recipe + '.dockerignore', '.dockerignore'):
        path = context / ignore
        if path.is_file():
            files[ignore] = path
    result = {}
    for name, path in sorted(files.items()):
        if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
            raise ValueError('Entrada ausente o enlazada: ' + name)
        result[name] = path.read_bytes()
    return result, recipe


def fingerprint(files, kind, arguments):
    digest = hashlib.sha256(json.dumps({'format': 1, 'kind': kind, 'args': arguments}, sort_keys=True).encode())
    for name, data in sorted(files.items()):
        digest.update(name.encode() + b'\0' + hashlib.sha256(data).digest())
    return digest.hexdigest()


def inspect(image):
    try:
        return json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True, stderr=subprocess.DEVNULL))[0]
    except subprocess.CalledProcessError:
        return None


def compose_build(directory, image, dockerfile, arguments):
    # Keep the orchestration file OUTSIDE COPY . contexts (notably backend).
    with tempfile.TemporaryDirectory(prefix='compose-', dir=directory.parent) as temporary:
        config = Path(temporary) / 'build-compose.json'
        config.write_text(json.dumps({'services': {'image': {'image': image, 'build': {
            'context': str(directory), 'dockerfile': dockerfile, 'args': arguments}}}}))
        run('docker', 'compose', '--ansi', 'never', '-p', 'capibloques-cache', '-f', str(config), 'build', 'image')


def build(root, kind, image, revision, cache_root):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Se requiere revisión Git completa.')
    files, recipe = inputs(root, kind)
    arguments = {}
    identity_arguments = {}
    if kind == 'compiler':
        base = inspect('capibloques-compiler-dev:phase9')
        if not base:
            raise ValueError('Falta la imagen SDK instalada; no se descarga ni reinstala implícitamente.')
        arguments['CAPI_COMPILER_BASE'] = 'capibloques-compiler-dev:phase9'
        identity_arguments['sdkImage'] = base['Id']
    key = fingerprint(files, kind, {**arguments, **identity_arguments})
    cached_image = 'capibloques-cache-' + kind + ':' + key
    existing = inspect(cached_image)
    if existing and (existing['Config'].get('Labels') or {}).get('com.capibloques.build-key') != key:
        raise ValueError('La imagen de caché no corresponde a sus entradas.')
    started = time.monotonic()
    cache_root = Path(cache_root)
    cache_root.mkdir(parents=True, exist_ok=True)
    if not existing:
        print(f'{kind}: construir; cambiaron sus entradas o no hay imagen conservada ({key[:12]}).', flush=True)
        with tempfile.TemporaryDirectory(prefix='context-', dir=cache_root) as temporary:
            directory = Path(temporary)
            for name, data in files.items():
                path = directory / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(data)
                path.chmod(0o644)
                os.utime(path, (0, 0))
            path = directory / recipe
            path.write_text(path.read_text() + '\nLABEL com.capibloques.build-key="' + key + '"\n')
            compose_build(directory, cached_image, recipe, arguments)
    else:
        print(f'{kind}: reutilizar imagen verificada ({key[:12]}); sin instalar dependencias ni compilar.', flush=True)
    # The application payload is identical, but deployment evidence still names
    # the requested Git revision. Only this tiny metadata layer varies.
    current = inspect(image)
    labels = (current or {}).get('Config', {}).get('Labels') or {}
    if labels.get('com.capibloques.build-key') != key or labels.get('org.opencontainers.image.revision') != revision:
        with tempfile.TemporaryDirectory(prefix='revision-', dir=cache_root) as temporary:
            directory = Path(temporary)
            (directory / 'Dockerfile').write_text(f'FROM {cached_image}\nLABEL org.opencontainers.image.revision="{revision}"\n')
            compose_build(directory, image, 'Dockerfile', {})
    # Touch an explicit use record; cleanup can retain recently used recipes.
    (cache_root / (kind + '-' + key + '.used')).touch()
    print(f'{kind}: listo en {time.monotonic()-started:.1f}s · imagen {image}', flush=True)
    return key


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--kind', choices=RECIPES, required=True)
    parser.add_argument('--image', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--cache-root', type=Path, default=Path('/var/cache/capibloques-builds'))
    args = parser.parse_args()
    build(args.root, args.kind, args.image, args.revision, args.cache_root)
