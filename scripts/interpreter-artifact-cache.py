#!/usr/bin/env python3
"""Verified interpreter bundles shared across release directories; no SDK cleanup."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import tempfile

PROFILES = ('wemos-d1-r32', 'diymall-esp32-s3-devkitc-v1-n16r8', 'waveshare-esp32-s3-touch-lcd-5-28117')


def recipe_key(root, version, revision, toolchain):
    digest = hashlib.sha256(json.dumps([1, version, revision, toolchain]).encode())
    for name in ('build-interpreter-firmware.sh', 'prepare-interpreter-cache.py',
                 'package-interpreter-firmware.py', 'interpreter-artifact-cache.py'):
        digest.update(name.encode() + b'\0' + hashlib.sha256((root / 'scripts' / name).read_bytes()).digest())
    return digest.hexdigest()


def validated(directory, version, revision, key):
    files = []
    try:
        for profile in PROFILES:
            path = directory / (profile + '.json')
            info = json.loads(path.read_text())
            bundle = directory / info['bundle']
            if (directory.is_symlink() or path.is_symlink() or bundle.is_symlink() or bundle.parent != directory or
                    info['board'] != profile or info['version'] != version or info['abi'] != 1 or
                    info['sourceRevision'] != revision or info.get('recipeKey') != key or
                    bundle.stat().st_size != info['bytes'] or
                    hashlib.sha256(bundle.read_bytes()).hexdigest() != info['sha256']):
                return None
            files.extend((bundle, path))
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return files


def transfer(source, target, files):
    target.mkdir(parents=True, exist_ok=True)
    if target.is_symlink():
        raise ValueError('No se publica sobre un enlace simbólico.')
    # Validate the complete set first; publish each zip before its manifest.
    for path in files:
        with tempfile.NamedTemporaryFile(dir=target, delete=False) as temp:
            temporary = Path(temp.name)
        try:
            shutil.copyfile(source / path.name, temporary)
            temporary.chmod(0o644)
            if hasattr(os, 'geteuid') and os.geteuid() == 0:
                os.chown(temporary, 1000, 1000)
            temporary.replace(target / path.name)
        finally:
            temporary.unlink(missing_ok=True)


def operate(action, root, cache, destination, version, revision, toolchain):
    key = recipe_key(root, version, revision, toolchain)
    if action == 'key':
        print(key)
        return True
    entry = cache / key
    source, target = (entry, destination) if action == 'restore' else (destination, entry)
    files = validated(source, version, revision, key)
    if files is None:
        if action == 'store':
            raise ValueError('Firmware incompleto/incompatible: no se incorpora a la caché.')
        print('Intérprete: no hay paquete compatible conservado; se usará la compilación incremental.', flush=True)
        return False
    transfer(source, target, files)
    print('Intérprete: ' + ('paquetes reutilizados y SHA-256 verificados; sin compilar.' if action == 'restore'
                            else 'paquetes verificados conservados para los demás ambientes.'), flush=True)
    return True


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('key', 'restore', 'store'))
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=Path('/home/capi/capibloques-envs/firmware-cache'))
    parser.add_argument('--destination', type=Path)
    parser.add_argument('--version', required=True)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--toolchain', default=os.environ.get('CAPI_INTERPRETER_TOOLCHAIN_KEY', 'local'))
    args = parser.parse_args()
    if args.action != 'key' and args.destination is None:
        parser.error('--destination es obligatorio para restaurar/conservar paquetes.')
    if not re.fullmatch(r'[A-Za-z0-9_.-]{1,128}', args.revision):
        parser.error('Revisión inválida.')
    if not operate(args.action, args.root, args.cache, args.destination, args.version, args.revision, args.toolchain):
        raise SystemExit(3)
