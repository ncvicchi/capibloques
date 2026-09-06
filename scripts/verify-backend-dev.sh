#!/bin/sh
# Pruebas de integración; sólo DEV/CI. Requiere api y db ya migrados.
set -eu
cd "$(dirname "$0")/.."
dc() { docker compose --ansi never -f compose.dev.yaml -f compose.backend.dev.yaml "$@"; }

dc exec -T api python manage.py check
dc exec -T api python manage.py migrate --check
# La API no tiene CREATEDB. Sólo el administrador prepara esta base de TEST.
if ! dc exec -T db psql -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='test_capibloques'" | grep -q 1; then
  dc exec -T db createdb -U postgres -O capibloques test_capibloques
fi
dc exec -T api python manage.py test tests --keepdb --noinput

if [ "${1:-}" = "--restart" ]; then
  # Es un registro real escrito por migrate, no una marca recreada al arrancar.
  query="from django.db.migrations.recorder import MigrationRecorder; print(MigrationRecorder.Migration.objects.get(app='sessions',name='0001_initial').applied.isoformat())"
  before="$(dc exec -T api python manage.py shell --no-imports -c "$query")"
  test -n "$before"
  dc stop api db
  dc up -d --force-recreate --wait --wait-timeout 120 db api
  after="$(dc exec -T api python manage.py shell --no-imports -c "$query")"
  test "$before" = "$after"
  dc exec -T api python manage.py migrate --check
  printf 'Persistencia comprobada: mismo registro tras recrear API y PostgreSQL.\n'
fi
