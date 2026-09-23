#!/usr/bin/env bash
set -Eeuo pipefail

# This script is intentionally executed from the already fetched Git object:
#   git show <verified-commit>:scripts/deploy-dev-remote.sh | sudo bash -s -- ...
# It therefore does not depend on the checkout already containing this version.

REPOSITORY=/home/capi/capibloques
STATE_FILE=/var/lib/capibloques/dev-deploy.state
EXPECTED_COMMIT=
CHECK_ONLY=0

while (($#)); do
  case "$1" in
    --expected-commit)
      EXPECTED_COMMIT=${2:-}
      shift 2
      ;;
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    *)
      echo "Argumento desconocido: $1" >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ $EUID -eq 0 ]] || fail "la operación remota requiere sudo"
[[ $(hostname) == capi-dev ]] || fail "destino incorrecto; se esperaba capi-dev"
[[ $EXPECTED_COMMIT =~ ^[0-9a-f]{40}$ ]] || fail "commit objetivo inválido"
[[ -d $REPOSITORY/.git ]] || fail "no existe el checkout DEV esperado"

cd "$REPOSITORY"
repo_git() {
  sudo -u capi git -C "$REPOSITORY" "$@"
}

[[ -z $(repo_git status --porcelain) ]] || fail "el checkout DEV tiene cambios locales"
TARGET_COMMIT=$(repo_git rev-parse origin/main)
[[ $TARGET_COMMIT == "$EXPECTED_COMMIT" ]] || fail "origin/main no coincide con el commit verificado"
CURRENT_COMMIT=$(repo_git rev-parse HEAD)
repo_git merge-base --is-ancestor "$CURRENT_COMMIT" "$TARGET_COMMIT" || fail "la actualización no es fast-forward"

changed_files=$(repo_git diff --name-only "$CURRENT_COMMIT..$TARGET_COMMIT")
RUN_MIGRATIONS=0
REBUILD_COMPILER=0
BUILD_INTERPRETER=0
unknown_maintenance=()
while IFS= read -r file; do
  [[ -n $file ]] || continue
  case "$file" in
    backend/compiler/migrations/0002_build_board_profile.py)
      RUN_MIGRATIONS=1
      ;;
    ops/compiler/archive.py|ops/compiler/entry.py|ops/compiler/runner.py)
      REBUILD_COMPILER=1
      ;;
    ops/public-dev/test_contracts.py)
      # Es una prueba local/CI del contrato operativo; no se instala ni forma
      # parte del runtime público de la VM.
      ;;
    *)
      unknown_maintenance+=("$file")
      ;;
  esac
done < <(grep -E '(^|/)(migrations)/|(^|/)(requirements[^/]*\.txt|pyproject\.toml|poetry\.lock)$|^compose\.|^ops/(compiler|postgres|public-dev)/' <<<"$changed_files" || true)
if ((${#unknown_maintenance[@]})); then
  printf 'Cambios que requieren un mantenimiento todavía no automatizado:\n' >&2
  printf '  - %s\n' "${unknown_maintenance[@]}" >&2
  fail "hay migraciones, dependencias o infraestructura no reconocidas; DEV no fue modificado"
fi
INTERPRETER_SOURCE=$(repo_git rev-parse "$TARGET_COMMIT:interpreter")
if ! python3 - "$REPOSITORY/public/interpreter" "$INTERPRETER_SOURCE" <<'PY'
import json, pathlib, sys
root, revision = pathlib.Path(sys.argv[1]), sys.argv[2]
profiles = ("wemos-d1-r32", "diymall-esp32-s3-devkitc-v1-n16r8")
for profile in profiles:
    try:
        info = json.loads((root / f"{profile}.json").read_text(encoding="utf-8"))
        bundle = root / info["bundle"]
        assert info["sourceRevision"] == revision and info["version"] == "1.0.0" and bundle.is_file()
    except Exception:
        raise SystemExit(1)
PY
then
  BUILD_INTERPRETER=1
fi
if ((RUN_MIGRATIONS)); then
  migration_object=$(repo_git rev-parse "$TARGET_COMMIT:backend/compiler/migrations/0002_build_board_profile.py" 2>/dev/null || true)
  [[ $migration_object == 8920d046b1a13bea5b7a989daf5899f2860a609a ]] || \
    fail "la migración compiler.0002 no coincide con la versión auditada; DEV no fue modificado"
fi

WITH_API=0
VERIFY_BACKEND=0
if grep -Eq '^backend/' <<<"$changed_files"; then
  WITH_API=1
  VERIFY_BACKEND=1
fi

runtime() {
  capibloques-dev-runtime "$@"
}

api_container() {
  docker ps \
    --filter label=com.docker.compose.project=capibloques-dev \
    --filter label=com.docker.compose.service=api \
    --format '{{.ID}}'
}

API_CONTAINER=$(api_container)
[[ -n $API_CONTAINER && $API_CONTAINER != *$'\n'* ]] || fail "no hay exactamente una API DEV activa"

manage() {
  docker exec "$API_CONTAINER" python manage.py shell -c "$1"
}

compiler_state() {
  manage "from compiler.models import Build,CompilerConfig; c=CompilerConfig.objects.get(pk=1); print(f'{int(c.paused)} {c.revision} {Build.objects.filter(state=\"queued\").count()} {Build.objects.filter(state=\"building\").count()} {c.concurrency} {c.ceiling}')" | tail -n 1
}

set_paused() {
  local desired=$1
  manage "from accounts.models import access_lock; from compiler.models import CompilerConfig,CompilerEvent; from compiler.views import settings_record
with access_lock():
 c=CompilerConfig.objects.select_for_update().get(pk=1); before=settings_record(c); wanted=bool($desired)
 if c.paused != wanted:
  c.paused=wanted; c.revision += 1; c.save(); CompilerEvent.objects.create(actor_id_snapshot=None,before=before,after=settings_record(c))
 print(f'{int(c.paused)} {c.revision}')" | tail -n 1
}

runtime validate >/dev/null
curl --fail --silent --show-error --max-time 12 http://127.0.0.1:3000/api/health/ready/ >/dev/null
read -r paused revision queued building concurrency ceiling <<<"$(compiler_state)"
printf 'Preflight: checkout=%s objetivo=%s pausa=%s revision=%s cola=%s activos=%s concurrencia=%s/%s api=%s\n' \
  "$CURRENT_COMMIT" "$TARGET_COMMIT" "$paused" "$revision" "$queued" "$building" "$concurrency" "$ceiling" "$WITH_API"
((RUN_MIGRATIONS)) && echo "Mantenimiento reconocido: respaldo PostgreSQL y migración compiler.0002."
((REBUILD_COMPILER)) && echo "Mantenimiento reconocido: reconstrucción y registro de la imagen del compilador."
((BUILD_INTERPRETER)) && echo "Firmware intérprete: se construirá una vez para Wemos y ESP32-S3; no se compila por proyecto."

if ((CHECK_ONLY)); then
  runtime status
  exit 0
fi

[[ $queued == 0 ]] || fail "hay trabajos en cola; no se inició el mantenimiento"

install -d -m 0750 -o root -g root "$(dirname "$STATE_FILE")"
if [[ -f $STATE_FILE ]]; then
  saved_target=$(sed -n 's/^target=//p' "$STATE_FILE")
  original_paused=$(sed -n 's/^original_paused=//p' "$STATE_FILE")
  saved_with_api=$(sed -n 's/^with_api=//p' "$STATE_FILE")
  saved_verify_backend=$(sed -n 's/^verify_backend=//p' "$STATE_FILE")
  saved_run_migrations=$(sed -n 's/^run_migrations=//p' "$STATE_FILE")
  saved_rebuild_compiler=$(sed -n 's/^rebuild_compiler=//p' "$STATE_FILE")
  [[ $original_paused =~ ^[01]$ && $saved_with_api =~ ^[01]$ && $saved_verify_backend =~ ^[01]$ ]] || \
    fail "el estado del mantenimiento anterior está incompleto; revisar $STATE_FILE"
  [[ $saved_target =~ ^[0-9a-f]{40}$ ]] && repo_git cat-file -e "$saved_target^{commit}" 2>/dev/null || \
    fail "el estado del mantenimiento anterior contiene un commit inválido; revisar $STATE_FILE"
  if [[ -z $saved_run_migrations && -z $saved_rebuild_compiler && $saved_target == "$CURRENT_COMMIT" ]]; then
    # Marcador de la versión anterior del orquestador. Sólo es migrable cuando
    # su objetivo ya es exactamente el checkout saludable verificado arriba:
    # no queda un diff viejo del que inferir pasos de mantenimiento pendientes.
    saved_run_migrations=0
    saved_rebuild_compiler=0
    echo "Migrando marcador anterior ya aplicado en $saved_target"
  fi
  [[ $saved_run_migrations =~ ^[01]$ && $saved_rebuild_compiler =~ ^[01]$ ]] || \
    fail "el marcador anterior no permite deducir mantenimiento pendiente; revisar $STATE_FILE"
  if [[ $saved_target != "$TARGET_COMMIT" ]]; then
    repo_git merge-base --is-ancestor "$saved_target" "$TARGET_COMMIT" || \
      fail "el mantenimiento pendiente pertenece a otra línea de Git; revisar $STATE_FILE"
    repo_git merge-base --is-ancestor "$CURRENT_COMMIT" "$saved_target" || \
      fail "el checkout ya no corresponde al inicio del mantenimiento pendiente; revisar $STATE_FILE"
    # El objetivo nuevo es descendiente del anterior y el preflight acaba de
    # auditar todos sus cambios. Conservamos cualquier paso de mantenimiento
    # que el intento anterior todavía podía deber y sumamos los del objetivo.
    if ((saved_with_api)); then WITH_API=1; fi
    if ((saved_verify_backend)); then VERIFY_BACKEND=1; fi
    if ((saved_run_migrations)); then RUN_MIGRATIONS=1; fi
    if ((saved_rebuild_compiler)); then REBUILD_COMPILER=1; fi
    umask 077
    printf 'target=%s\noriginal_paused=%s\nwith_api=%s\nverify_backend=%s\nrun_migrations=%s\nrebuild_compiler=%s\n' \
      "$TARGET_COMMIT" "$original_paused" "$WITH_API" "$VERIFY_BACKEND" "$RUN_MIGRATIONS" "$REBUILD_COMPILER" >"$STATE_FILE"
    echo "Reanudando el mantenimiento $saved_target y avanzando al descendiente auditado $TARGET_COMMIT"
  else
    WITH_API=$saved_with_api
    VERIFY_BACKEND=$saved_verify_backend
    RUN_MIGRATIONS=$saved_run_migrations
    REBUILD_COMPILER=$saved_rebuild_compiler
    echo "Reanudando mantenimiento interrumpido para $saved_target"
  fi
else
  original_paused=$paused
  umask 077
  printf 'target=%s\noriginal_paused=%s\nwith_api=%s\nverify_backend=%s\nrun_migrations=%s\nrebuild_compiler=%s\n' \
    "$TARGET_COMMIT" "$original_paused" "$WITH_API" "$VERIFY_BACKEND" "$RUN_MIGRATIONS" "$REBUILD_COMPILER" >"$STATE_FILE"
fi

# Un estado reanudado puede exigir una migración que ya no aparece en el diff
# porque el checkout alcanzó el objetivo anterior antes del corte.
if ((RUN_MIGRATIONS)); then
  migration_object=$(repo_git rev-parse "$TARGET_COMMIT:backend/compiler/migrations/0002_build_board_profile.py" 2>/dev/null || true)
  [[ $migration_object == 8920d046b1a13bea5b7a989daf5899f2860a609a ]] || \
    fail "la migración compiler.0002 pendiente no coincide con la versión auditada"
fi

set_paused 1 >/dev/null
echo "Admisión pausada; esperando trabajos ya iniciados."
deadline=$((SECONDS + 900))
while :; do
  read -r _ _ queued building _ _ <<<"$(compiler_state)"
  [[ $queued == 0 ]] || fail "apareció un trabajo en cola después de la pausa"
  ((building == 0)) && break
  ((SECONDS < deadline)) || fail "los trabajos activos no terminaron en 15 minutos"
  sleep 5
done

systemctl stop capibloques-compiler.service
[[ $(systemctl is-active capibloques-compiler.service || true) == inactive ]] || fail "no se pudo detener el planificador"

compose_dev() {
  docker compose --ansi never \
    -f compose.dev.yaml -f compose.backend.dev.yaml -f compose.compiler.dev.yaml "$@"
}

if ((RUN_MIGRATIONS)); then
  backup_dir=/var/lib/capibloques/backups
  backup_file="$backup_dir/pre-${TARGET_COMMIT}.dump"
  install -d -m 0700 -o root -g root "$backup_dir"
  if [[ ! -f $backup_file ]]; then
    backup_temp="${backup_file}.tmp"
    rm -f "$backup_temp"
    umask 077
    compose_dev exec -T db pg_dump -U postgres -d capibloques -Fc </dev/null >"$backup_temp"
    [[ -s $backup_temp ]] || fail "el respaldo PostgreSQL quedó vacío"
    compose_dev exec -T db pg_restore -l <"$backup_temp" >/dev/null
    mv "$backup_temp" "$backup_file"
  else
    [[ -s $backup_file ]] || fail "el respaldo PostgreSQL existente está vacío"
    compose_dev exec -T db pg_restore -l <"$backup_file" >/dev/null
  fi
  echo "Respaldo PostgreSQL verificado: $backup_file"
fi

echo "Actualizando checkout por fast-forward."
repo_git pull --ff-only origin main
[[ $(repo_git rev-parse HEAD) == "$TARGET_COMMIT" ]] || fail "el checkout no quedó en el commit objetivo"

if ((REBUILD_COMPILER)); then
  echo "Reconstruyendo la imagen aislada del compilador (se reutilizan las capas locales)."
  docker build --quiet --memory=1024m --memory-swap=1600m --cpu-period=100000 --cpu-quota=80000 \
    -f ops/compiler/Dockerfile -t capibloques-compiler-dev:phase9 .
  python3 ops/compiler/install.py
  compiler_image=$(docker image inspect capibloques-compiler-dev:phase9 --format '{{.Id}}')
  [[ $compiler_image =~ ^sha256:[0-9a-f]{64}$ ]] || fail "la imagen nueva del compilador no tiene un ID válido"
  compiler_recipe=${compiler_image#sha256:}
fi

if ((RUN_MIGRATIONS)); then
  echo "Aplicando la migración de placa de compilación."
  compose_dev exec -T api python manage.py migrate --noinput
  compose_dev exec -T api python manage.py migrate --check
fi

if ((BUILD_INTERPRETER)); then
  echo "Construyendo los dos firmwares intérprete reproducibles. La primera ejecución puede descargar la imagen ESP-IDF."
  docker run --rm --cpus 1 --memory 1200m --memory-swap 1500m \
    --user "$(id -u capi):$(id -g capi)" -e HOME=/tmp/capi-idf -e IDF_PY_BUILD_JOBS=2 \
    -v "$REPOSITORY:/project" -w /project \
    espressif/idf:v5.5.5@sha256:a9231d0697ab8f7517cc072e93b7c83e04907bfbfba80b6440d7dbbf90665cf2 \
    bash -lc '. "$IDF_PATH/export.sh" >/dev/null && ./scripts/build-interpreter-firmware.sh 1.0.0 /project/public/interpreter '"$INTERPRETER_SOURCE"
  python3 - "$REPOSITORY/public/interpreter" "$INTERPRETER_SOURCE" <<'PY'
import hashlib, json, pathlib, sys
root, revision = pathlib.Path(sys.argv[1]), sys.argv[2]
for profile in ("wemos-d1-r32", "diymall-esp32-s3-devkitc-v1-n16r8"):
    info = json.loads((root / f"{profile}.json").read_text(encoding="utf-8"))
    bundle = root / info["bundle"]
    assert info["sourceRevision"] == revision and info["version"] == "1.0.0"
    assert bundle.stat().st_size == info["bytes"]
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == info["sha256"]
print("Firmware intérprete empaquetado y verificado para las dos placas.")
PY
fi

if ((WITH_API)); then
  runtime deploy --with-api
  API_CONTAINER=$(api_container)
  [[ -n $API_CONTAINER && $API_CONTAINER != *$'\n'* ]] || fail "la API no volvió correctamente"
else
  runtime deploy
fi

# No alcanza con que el checkout haya avanzado: el editor activo debe usar la
# imagen construida para ese mismo commit. Esta comprobación evita declarar un
# despliegue correcto cuando quedó sirviéndose el contenedor anterior.
EDITOR_CONTAINER=$(docker ps \
  --filter label=com.docker.compose.project=capibloques-dev \
  --filter label=com.docker.compose.service=editor \
  --format '{{.ID}}')
[[ -n $EDITOR_CONTAINER && $EDITOR_CONTAINER != *$'\n'* ]] || \
  fail "no hay exactamente un editor DEV activo después del despliegue"
EXPECTED_EDITOR_IMAGE="capibloques-editor-dev:${TARGET_COMMIT:0:12}"
ACTIVE_EDITOR_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$EDITOR_CONTAINER")
ACTIVE_EDITOR_REVISION=$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$EDITOR_CONTAINER")
[[ $ACTIVE_EDITOR_IMAGE == "$EXPECTED_EDITOR_IMAGE" ]] || \
  fail "el editor activo sigue en $ACTIVE_EDITOR_IMAGE; se esperaba $EXPECTED_EDITOR_IMAGE"
[[ $ACTIVE_EDITOR_REVISION == "$TARGET_COMMIT" ]] || \
  fail "la imagen activa declara $ACTIVE_EDITOR_REVISION; se esperaba $TARGET_COMMIT"
echo "Editor activo verificado: $EXPECTED_EDITOR_IMAGE"

if ((VERIFY_BACKEND)); then
  sh scripts/verify-backend-dev.sh
fi

if ((REBUILD_COMPILER)); then
  printf '{"recipe":"%s","ceiling":%s}' "$compiler_recipe" "$ceiling" | \
    compose_dev exec -T api python manage.py compiler_dispatch register
  echo "Receta del compilador registrada: $compiler_recipe"
fi

runtime validate >/dev/null
curl --fail --silent --show-error --max-time 12 http://127.0.0.1:3000/api/health/ready/ >/dev/null
curl --fail --silent --show-error --max-time 20 https://capibloques.dev.nvicchi.com/api/health/ready/ >/dev/null

systemctl start capibloques-compiler.service
[[ $(systemctl is-active capibloques-compiler.service) == active ]] || fail "el planificador no volvió a estar activo"
set_paused "$original_paused" >/dev/null
rm -f "$STATE_FILE"

read -r paused revision queued building concurrency ceiling <<<"$(compiler_state)"
printf 'Validación final correcta: commit=%s pausa=%s cola=%s activos=%s concurrencia=%s/%s\n' \
  "$TARGET_COMMIT" "$paused" "$queued" "$building" "$concurrency" "$ceiling"
