"""Importación explícita a DEV3 vacío. No conecta al servidor de origen."""
import argparse
import collections
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('snapshot', type=Path)
    args = parser.parse_args()
    if socket.gethostname() != 'capi-dev3' or os.getuid() != 1000:
        parser.error('Sólo capi en capi-dev3; nunca sudo.')
    marker = Path.home()/'.local/share/capibloques-dev3/seeded.json'
    if marker.exists():
        print('La copia inicial ya fue importada. No se sobrescribieron datos.')
        return
    spec = importlib.util.spec_from_file_location('seed_helpers', ROOT/'ops/environments/seed.py')
    helpers = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helpers)
    records = json.loads(args.snapshot.read_text())
    # Rate limits are transient, unlike users, courses, school and projects.
    records = [record for record in records if record['model'] != 'accounts.loginbucket']
    payload = json.dumps(records)
    expected = helpers.validate_fixture(payload)
    base = ['docker', 'compose', '-f', str(ROOT/'compose.dev3.yaml'), 'exec', '-T', 'api', 'python', 'manage.py']

    def shell(code):
        output = subprocess.check_output([*base, 'shell', '--verbosity', '0', '-c', code], text=True)
        return output.strip().splitlines()[-1]

    before = json.loads(shell(helpers.COUNTS_CODE))
    if any(count for model, count in before.items() if model.startswith(('accounts.', 'courses.', 'projects.'))):
        raise SystemExit('El destino ya tiene datos. No se reemplazó ni borró nada.')
    subprocess.run([*base, 'loaddata', '--format', 'json', '-'], input=payload, text=True, check=True)
    imported = shell(helpers.SNAPSHOT_CODE)
    if helpers.comparable(imported) != helpers.comparable(payload):
        raise SystemExit('La verificación no coincide. No reimportar ni borrar; revisar el destino.')
    counts = dict(collections.Counter(record['model'] for record in records))
    marker.write_text(json.dumps(dict(source='dev1', counts=counts, sha256=hashlib.sha256(payload.encode()).hexdigest())))
    marker.chmod(0o600)
    print(json.dumps(dict(status='copia independiente verificada', counts=counts)))


if __name__ == '__main__':
    main()
