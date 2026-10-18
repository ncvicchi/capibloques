"""Explicit one-time clone of application data from main into EMPTY dev1/dev2.

No session/secret/compiler-queue copying. Source is a repeatable-read snapshot;
target import is transactional. Password hashes and school images stay private.
"""
import argparse
import collections
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import time

RUNTIME = Path('/opt/capibloques-environments/manage.py')
APPLICATIONS = ('accounts', 'school', 'courses', 'projects')
SNAPSHOT_CODE = """
from django.apps import apps
from django.contrib.auth.models import Group
from django.core import serializers
from django.db import connection,transaction
from itertools import chain
models=[Group]+[m for app in ('accounts','school','courses','projects') for m in apps.get_app_config(app).get_models()]
with transaction.atomic():
 with connection.cursor() as cursor: cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
 print(serializers.serialize('json',chain.from_iterable(m.objects.all().order_by('pk').iterator() for m in models),use_natural_foreign_keys=True))
"""
COUNTS_CODE = """
import json
from django.apps import apps
print(json.dumps({m._meta.label_lower:m.objects.count() for app in ('accounts','school','courses','projects') for m in apps.get_app_config(app).get_models()}))
"""


def validate_fixture(payload):
    records = json.loads(payload)
    if not isinstance(records, list):
        raise ValueError('Snapshot inválido.')
    counts = collections.Counter()
    for record in records:
        model = record['model']
        if model != 'auth.group' and model.split('.')[0] not in APPLICATIONS:
            raise ValueError('El snapshot incluye datos operativos que no se deben copiar.')
        counts[model] += 1
    return dict(counts)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('environment', choices=('dev1', 'dev2'))
    parser.add_argument('--copy-main-data', action='store_true', required=True)
    parser.add_argument('--snapshot', type=Path, help='Reutilizar el snapshot privado de la primera copia, no otro archivo.')
    args = parser.parse_args()
    if os.getuid() != 0 or socket.gethostname() != 'capi-dev':
        parser.error('Sólo sudo en capi-dev, con autorización explícita para copiar datos.')
    # Take the SAME inode used by the user updater; never create it as root.
    lock = open('/home/capi/.local/state/capibloques/dev-operation.lock', 'r+')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    module = importlib.util.spec_from_file_location('environment_runtime', RUNTIME)
    runtime = importlib.util.module_from_spec(module)
    module.loader.exec_module(runtime)
    spec = runtime.layout(args.environment)
    marker = spec['directory']/'seeded-from-main.json'
    if marker.exists():
        print('Ya se realizó la copia inicial. No se sobrescribieron datos.')
        return
    if (spec['directory']/'pending.json').exists():
        raise RuntimeError('Resolver la actualización pendiente antes de copiar datos.')
    deployed = (spec['directory']/'deployed').read_text().strip()
    if runtime.git('rev-parse', 'HEAD:backend') != runtime.git('rev-parse', deployed+':backend'):
        raise RuntimeError('Los backends difieren; revisar compatibilidad de la copia antes de importar.')
    before = json.loads(runtime.manage(spec, 'shell', '-c', COUNTS_CODE, capture=True).strip().splitlines()[-1])
    if before.get('accounts.user', 0) or any(count for model, count in before.items() if model.startswith(('projects.', 'courses.'))):
        raise RuntimeError('El destino ya tiene usuarios/cursos/proyectos. NO se sobrescribirá.')
    root = Path('/var/lib/capibloques-environments/seeds')
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    if args.snapshot:
        snapshot = args.snapshot.resolve()
        if snapshot.parent != root or not snapshot.is_file() or snapshot.is_symlink():
            raise ValueError('Sólo snapshots privados de seeds, sin enlaces.')
        payload = snapshot.read_text()
    else:
        payload = runtime.main_manage(SNAPSHOT_CODE)
        validate_fixture(payload)
        snapshot = root/f'main-{time.time_ns()}.json'
        runtime.atomic(snapshot, payload)
    expected = validate_fixture(payload)
    # stdout only reports counts; never echo serialized users, hashes or images.
    runtime.manage(spec, 'loaddata', '--format', 'json', '-', data=payload)
    after = json.loads(runtime.manage(spec, 'shell', '-c', COUNTS_CODE, capture=True).strip().splitlines()[-1])
    for model, count in expected.items():
        if model != 'auth.group' and after.get(model) != count:
            raise RuntimeError('La copia no coincide en '+model+'; no se marca como completada.')
    imported = runtime.manage(spec, 'shell', '-c', SNAPSHOT_CODE, capture=True).strip().splitlines()[-1]
    if json.loads(imported) != json.loads(payload):
        raise RuntimeError('La verificación de contenido no coincide; revisar sin volver a sobrescribir.')
    runtime.atomic(marker, json.dumps(dict(snapshot=str(snapshot), sha256=hashlib.sha256(payload.encode()).hexdigest(),
                                          sourceRevision=runtime.git('rev-parse', 'HEAD'), counts=after)))
    print(json.dumps(dict(environment=args.environment, status='copiado y verificado', counts=after, snapshot=str(snapshot))))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f'ERROR: {error}') from None
