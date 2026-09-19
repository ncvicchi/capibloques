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
if grep -Eq '(^|/)(migrations)/|(^|/)(requirements[^/]*\.txt|pyproject\.toml|poetry\.lock)$|^compose\.|^ops/(compiler|postgres|public-dev)/' <<<"$changed_files"; then
  fail "hay migraciones, dependencias o infraestructura; requieren mantenimiento manual específico"
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

runtime validate
curl --fail --silent --show-error --max-time 12 http://127.0.0.1:3000/api/health/ready/ >/dev/null
read -r paused revision queued building concurrency ceiling <<<"$(compiler_state)"
printf 'Preflight: checkout=%s objetivo=%s pausa=%s revision=%s cola=%s activos=%s concurrencia=%s/%s api=%s\n' \
  "$CURRENT_COMMIT" "$TARGET_COMMIT" "$paused" "$revision" "$queued" "$building" "$concurrency" "$ceiling" "$WITH_API"

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
  [[ $saved_target == "$TARGET_COMMIT" && $original_paused =~ ^[01]$ && $saved_with_api =~ ^[01]$ && $saved_verify_backend =~ ^[01]$ ]] || \
    fail "existe un mantenimiento anterior distinto; revisar $STATE_FILE"
  WITH_API=$saved_with_api
  VERIFY_BACKEND=$saved_verify_backend
  echo "Reanudando mantenimiento interrumpido para $saved_target"
else
  original_paused=$paused
  umask 077
  printf 'target=%s\noriginal_paused=%s\nwith_api=%s\nverify_backend=%s\n' \
    "$TARGET_COMMIT" "$original_paused" "$WITH_API" "$VERIFY_BACKEND" >"$STATE_FILE"
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

echo "Actualizando checkout por fast-forward."
repo_git pull --ff-only origin main
[[ $(repo_git rev-parse HEAD) == "$TARGET_COMMIT" ]] || fail "el checkout no quedó en el commit objetivo"

if ((WITH_API)); then
  runtime deploy --with-api
  API_CONTAINER=$(api_container)
  [[ -n $API_CONTAINER && $API_CONTAINER != *$'\n'* ]] || fail "la API no volvió correctamente"
else
  runtime deploy
fi

if ((VERIFY_BACKEND)); then
  sh scripts/verify-backend-dev.sh
fi

runtime validate
curl --fail --silent --show-error --max-time 12 http://127.0.0.1:3000/api/health/ready/ >/dev/null
curl --fail --silent --show-error --max-time 20 https://capibloques.dev.nvicchi.com/api/health/ready/ >/dev/null

systemctl start capibloques-compiler.service
[[ $(systemctl is-active capibloques-compiler.service) == active ]] || fail "el planificador no volvió a estar activo"
set_paused "$original_paused" >/dev/null
rm -f "$STATE_FILE"

read -r paused revision queued building concurrency ceiling <<<"$(compiler_state)"
printf 'OK: commit=%s pausa=%s revision=%s cola=%s activos=%s concurrencia=%s/%s\n' \
  "$TARGET_COMMIT" "$paused" "$revision" "$queued" "$building" "$concurrency" "$ceiling"
