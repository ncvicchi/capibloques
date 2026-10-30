#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY=/home/capi/capibloques
CHECK_ONLY=0
CI_MODE=fast
FULL_TAG=
BASELINE_CHECK_ID=0
TARGET_LABEL=desconocido
DEPLOY_CONFIRMED=0
REMOTE_SCRIPT=
INTEGRATE_BRANCH=
EXPECTED_BRANCH_COMMIT=
INTEGRATION_DIR=
MAIN_PUBLISHED=0
LOCK_ACQUIRED=0
LOCK_BUSY=0
LOCK_DIRECTORY=/home/capi/.local/state/capibloques
ENVIRONMENT=main
PROMOTE=
DESTINATION=main

usage() {
  echo "Uso: $0 --env dev1|dev2 [--branch RAMA [--commit SHA]] [--fast|--full]"
  echo "     $0 --promote dev1|dev2 [--commit SHA] [--fast|--full]"
  echo "     $0 [--fast|--full] --check-only"
  echo "--branch integra sólo en el ambiente indicado. --promote es la única integración en main."
  echo "Sin opciones sólo actualiza main. Otra operación activa sale 75 (sin cola)."
}

acquire_dev_lock() {
  command -v flock >/dev/null || { echo 'ERROR: falta flock (util-linux).' >&2; return 1; }
  umask 077
  mkdir -p "$LOCK_DIRECTORY"
  # No truncar ni eliminar este archivo: todos deben bloquear el mismo inode.
  exec 9>>"$LOCK_DIRECTORY/dev-operation.lock"
  if ! flock -n 9; then
    LOCK_BUSY=1
    echo 'DEV OCUPADO: otra integración o actualización sigue ejecutándose.' >&2
    [[ ! -r $LOCK_DIRECTORY/dev-operation.info ]] || cat "$LOCK_DIRECTORY/dev-operation.info" >&2
    echo 'No se modificó nada ni se puso en cola. Repetí al terminar la otra operación.' >&2
    return 75
  fi
  LOCK_ACQUIRED=1
  printf 'PID: %s\nInicio: %s\nAmbiente: %s\nRama: %s\nModo: %s\n' "$$" "$(date -Is)" "$DESTINATION" "${INTEGRATE_BRANCH:-$DESTINATION}" "$CI_MODE" >"$LOCK_DIRECTORY/dev-operation.info"
}

integrate_branch() {
  local branch_commit integration_commit
  branch_commit=$(git rev-parse --verify "refs/remotes/origin/$INTEGRATE_BRANCH^{commit}") || {
    echo "ERROR: no existe la rama remota $INTEGRATE_BRANCH." >&2; return 1;
  }
  [[ -z $EXPECTED_BRANCH_COMMIT || $branch_commit == "$EXPECTED_BRANCH_COMMIT" ]] || {
    echo 'ERROR: la rama cambió respecto del commit solicitado; no se integró ni actualizó DEV.' >&2; return 1;
  }
  echo "Rama: $INTEGRATE_BRANCH · commit: ${branch_commit:0:12}"
  TARGET_LABEL=${branch_commit:0:12}
  if git merge-base --is-ancestor "$branch_commit" "origin/$DESTINATION"; then
    echo 'La rama ya está integrada; se continúa con la actualización.'
    return
  fi
  git config user.name >/dev/null && git config user.email >/dev/null || {
    echo 'ERROR: configurá user.name y user.email de Git para crear el merge.' >&2; return 1;
  }
  INTEGRATION_DIR=$(mktemp -d /home/capi/capibloques-integracion-XXXXXX)
  echo "Integración aislada: $INTEGRATION_DIR/worktree"
  git worktree add --quiet --detach "$INTEGRATION_DIR/worktree" "origin/$DESTINATION"
  if ! git -C "$INTEGRATION_DIR/worktree" merge --no-ff --no-edit "$branch_commit"; then
    echo "ERROR: conflicto o fallo de merge; se conserva la copia. No se publicó $DESTINATION ni se actualizó su ambiente." >&2
    return 1
  fi
  integration_commit=$(git -C "$INTEGRATION_DIR/worktree" rev-parse HEAD)
  if ! git -C "$INTEGRATION_DIR/worktree" push origin "HEAD:refs/heads/$DESTINATION"; then
    echo 'ERROR: GitHub rechazó el push; no se fuerza ni se actualiza DEV. Revisá la copia de integración.' >&2
    return 1
  fi
  MAIN_PUBLISHED=1
  TARGET_LABEL=${integration_commit:0:12}
  git worktree remove "$INTEGRATION_DIR/worktree"
  rmdir "$INTEGRATION_DIR"
  INTEGRATION_DIR=
  git fetch --quiet origin "$DESTINATION"
  [[ $(git rev-parse "origin/$DESTINATION") == "$integration_commit" ]] || {
    echo "ERROR: $DESTINATION avanzó desde otra sesión después del push; no se actualizó. Revisá y repetí." >&2; return 1;
  }
  echo "Integración publicada en $DESTINATION: ${integration_commit:0:12}"
}

final_report() {
  local status=$?
  if ((status == 0 && !CHECK_ONLY && !DEPLOY_CONFIRMED)); then
    status=70
    echo "ERROR: el orquestador terminó sin confirmar la imagen activa; DEV no se considera desplegado." >&2
  fi
  if [[ -n $FULL_TAG ]]; then
    git -C "$REPOSITORY" push --quiet origin ":refs/tags/$FULL_TAG" >/dev/null 2>&1 || true
  fi
  if [[ -n $REMOTE_SCRIPT ]]; then
    rm -f "$REMOTE_SCRIPT"
  fi
  if ((LOCK_ACQUIRED)); then
    rm -f -- "$LOCK_DIRECTORY/dev-operation.info"
  fi
  if ((LOCK_BUSY)); then
    printf '\nRESULTADO: DEV OCUPADO; no se inició esta operación.\n' >&2
  elif ((status == 0)); then
    printf '\n============================================================\n'
    if ((CHECK_ONLY)); then
      printf 'RESULTADO: VERIFICACIÓN DEV COMPLETADA\n'
      printf 'Commit: %s\nEstado: auditoría correcta; no se hicieron cambios\n' "$TARGET_LABEL"
    else
      printf 'RESULTADO: ACTUALIZACIÓN DEV COMPLETADA\n'
      printf 'Ambiente: %s\nCommit: %s\nModo: %s\nEstado: listo para usar\n' "$DESTINATION" "$TARGET_LABEL" "$CI_MODE"
    fi
    printf '============================================================\n'
  else
    printf '\n============================================================\n' >&2
    if ((CHECK_ONLY)); then
      printf 'RESULTADO: VERIFICACIÓN DEV FALLÓ\n' >&2
    else
      printf 'RESULTADO: ACTUALIZACIÓN DEV FALLÓ\n' >&2
    fi
    printf 'Commit objetivo: %s\nModo: %s\nCódigo de salida: %s\nRevisá el último mensaje ERROR mostrado arriba.\n' "$TARGET_LABEL" "$CI_MODE" "$status" >&2
    printf '============================================================\n' >&2
  fi
  if ((status != 0 && !LOCK_BUSY)); then
    (( !MAIN_PUBLISHED )) || echo "La integración ya se publicó en $DESTINATION; la actualización no quedó confirmada. Repetí sin deshacer el merge." >&2
    [[ -z $INTEGRATION_DIR ]] || echo "Copia conservada para revisión: $INTEGRATION_DIR/worktree" >&2
  fi
  trap - EXIT
  exit "$status"
}
trap final_report EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
trap 'exit 129' HUP

while (($#)); do
  case "$1" in
    --branch|--commit|--env|--promote)
      [[ $# -ge 2 && -n $2 && $2 != --* ]] || { usage >&2; exit 2; }
      case "$1" in
        --branch) INTEGRATE_BRANCH=$2 ;;
        --commit) EXPECTED_BRANCH_COMMIT=$2 ;;
        --env) ENVIRONMENT=$2 ;;
        --promote) PROMOTE=$2 ;;
      esac
      shift
      ;;
    --help|-h) usage; trap - EXIT; exit 0 ;;
    --check-only) CHECK_ONLY=1 ;;
    --fast) CI_MODE=fast ;;
    --full) CI_MODE=full ;;
    *) usage >&2; exit 2 ;;
  esac
  shift
done
[[ $ENVIRONMENT == main || $ENVIRONMENT == dev1 || $ENVIRONMENT == dev2 ]] || { echo 'ERROR: ambiente inválido.' >&2; exit 2; }
if [[ -n $PROMOTE ]]; then
  [[ ( $PROMOTE == dev1 || $PROMOTE == dev2 ) && $ENVIRONMENT == main && -z $INTEGRATE_BRANCH && $CHECK_ONLY == 0 ]] || { echo 'ERROR: --promote sólo acepta dev1/dev2 y no admite --env, --branch ni --check-only.' >&2; exit 2; }
  INTEGRATE_BRANCH=$PROMOTE
elif [[ -n $INTEGRATE_BRANCH && $ENVIRONMENT == main ]]; then
  echo 'ERROR: --branch requiere --env dev1 o --env dev2; para main usá --promote.' >&2; exit 2
fi
DESTINATION=$ENVIRONMENT
[[ -z $EXPECTED_BRANCH_COMMIT || ( -n $INTEGRATE_BRANCH && $EXPECTED_BRANCH_COMMIT =~ ^[0-9a-f]{40}$ ) ]] || { echo 'ERROR: --commit requiere --branch/--promote y un SHA completo.' >&2; exit 2; }
[[ -z $INTEGRATE_BRANCH || ( $CHECK_ONLY == 0 && $INTEGRATE_BRANCH != main ) ]] || { echo 'ERROR: --branch no admite main ni --check-only; para auditar main omití --branch.' >&2; exit 2; }
[[ $(id -un) == capi ]] || { echo "Ejecutá esta orden como el usuario capi, sin sudo." >&2; exit 1; }
[[ $(hostname) == capi-dev ]] || { echo "Esta orden sólo funciona en capi-dev." >&2; exit 1; }

acquire_dev_lock
[[ -z $INTEGRATE_BRANCH ]] || git check-ref-format "refs/heads/$INTEGRATE_BRANCH" >/dev/null || { echo 'ERROR: nombre de rama inválido.' >&2; exit 2; }
cd "$REPOSITORY"
if find .git ! -user capi -print -quit | grep -q . || [[ ! -w .git/index ]]; then
  echo "Reparando propietario de los metadatos Git del checkout DEV."
  sudo chown -R capi:capi "$REPOSITORY/.git"
fi
[[ -r .git/index && -w .git/index ]] || { echo "No se pudo recuperar .git/index para el usuario capi." >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo "El checkout tiene cambios locales; no se actualizó." >&2; exit 1; }
[[ $(git branch --show-current) == main ]] || { echo 'ERROR: el checkout operativo debe estar en main; no se cambió de rama.' >&2; exit 1; }
for pending_operation in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
  [[ ! -e $(git rev-parse --git-path "$pending_operation") ]] || { echo "ERROR: operación Git pendiente: $pending_operation" >&2; exit 1; }
done
if [[ -n $INTEGRATE_BRANCH ]]; then
  if ! git fetch --quiet origin "refs/heads/main:refs/remotes/origin/main" "refs/heads/$INTEGRATE_BRANCH:refs/remotes/origin/$INTEGRATE_BRANCH"; then
    echo 'ERROR: no se pudieron traer main y la rama solicitada.' >&2
    exit 1
  fi
else
  git fetch --quiet origin main
fi
if [[ $DESTINATION != main ]]; then
  git fetch --quiet origin "refs/heads/$DESTINATION:refs/remotes/origin/$DESTINATION"
fi
git merge-base --is-ancestor HEAD origin/main || { echo 'ERROR: main local diverge; se conserva sin reset.' >&2; exit 1; }
if [[ -n $PROMOTE ]]; then
  deployed=$(sudo python3 /opt/capibloques-environments/manage.py deployed "$PROMOTE")
  [[ $deployed =~ ^[0-9a-f]{40}$ && ( -z $EXPECTED_BRANCH_COMMIT || $EXPECTED_BRANCH_COMMIT == "$deployed" ) ]] || { echo 'ERROR: revisión instalada distinta a la solicitada.' >&2; exit 1; }
  EXPECTED_BRANCH_COMMIT=$deployed
fi
if [[ -n $INTEGRATE_BRANCH ]]; then
  integrate_branch
fi
target=$(git rev-parse "origin/$DESTINATION")
TARGET_LABEL=${target:0:12}
if [[ $DESTINATION == main ]]; then git cat-file -e "$target:scripts/deploy-dev-remote.sh"; fi

if [[ $CI_MODE == fast ]]; then
  echo "Modo DEV directo: no se espera GitHub Actions. Las pruebas se hacen en DEV."
else
  FULL_TAG="ci-full-${target:0:12}-$(date +%s)"
  BASELINE_CHECK_ID=$(python3 - "$target" <<'PY'
import json, sys, urllib.request
request = urllib.request.Request(
    f"https://api.github.com/repos/ncvicchi/capibloques/commits/{sys.argv[1]}/check-runs?per_page=100",
    headers={"Accept": "application/vnd.github+json", "User-Agent": "capibloques-dev-update", "X-GitHub-Api-Version": "2022-11-28"},
)
with urllib.request.urlopen(request, timeout=20) as response:
    print(max((item.get("id", 0) for item in json.load(response)["check_runs"]), default=0))
PY
  )
  echo "Solicitando CI completa para $TARGET_LABEL…"
  git push --quiet origin "$target:refs/tags/$FULL_TAG"

  python3 - "$target" "$CI_MODE" "$BASELINE_CHECK_ID" <<'PY'
import json
import os
import sys
import time
import urllib.error
import urllib.request

commit = sys.argv[1]
mode = sys.argv[2]
baseline_check_id = int(sys.argv[3])
required = ("backend", "verify", "esp-idf", "firmware")
# La API pública admite 60 consultas por hora sin token. Una por minuto deja
# que el monitor permanezca activo sin consumir credenciales ni agotar el cupo.
poll_seconds = 60
# Cero significa esperar hasta que la CI termine. El operador siempre puede
# interrumpir con Ctrl+C sin modificar DEV.
timeout_seconds = int(os.environ.get("CAPIBLOQUES_CI_TIMEOUT_SECONDS", "0"))
started = time.monotonic()
last_snapshot = None
last_report = 0.0
api_errors = 0

def fetch_checks():
    request = urllib.request.Request(
        f"https://api.github.com/repos/ncvicchi/capibloques/commits/{commit}/check-runs?per_page=100",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "capibloques-dev-update",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.load(response)["check_runs"]
    except urllib.error.HTTPError as error:
        remaining = error.headers.get("X-RateLimit-Remaining")
        detail = "; límite público restante: " + remaining if remaining is not None else ""
        raise RuntimeError(f"HTTP {error.code}{detail}")
    except Exception as error:
        raise RuntimeError(str(error))

def current_required(checks):
    # Un reintento puede dejar más de un check con el mismo nombre. El id mayor
    # representa la ejecución más reciente y evita que un éxito viejo oculte el actual.
    latest = {}
    for check in checks:
        if mode == "full" and check.get("id", 0) <= baseline_check_id:
            continue
        name = check.get("name")
        if name in required and check.get("id", 0) >= latest.get(name, {}).get("id", -1):
            latest[name] = check
    return latest

def label(check):
    if check is None:
        return "pendiente (GitHub todavía no lo creó)"
    status = check.get("status")
    if status == "completed":
        conclusion = check.get("conclusion") or "sin resultado"
        if conclusion == "success":
            return "aprobado"
        if mode == "fast" and conclusion in ("skipped", "neutral"):
            return "omitido (no corresponde a este cambio)"
        return f"falló ({conclusion})"
    if status == "in_progress":
        return "en proceso"
    return f"pendiente ({status or 'sin estado'})"

def clock(seconds):
    seconds = max(0, int(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"

def progress(checks):
    accepted = ("success", "skipped", "neutral") if mode == "fast" else ("success",)
    approved = sum(checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") in accepted for name in required)
    active = sum(checks.get(name, {}).get("status") == "in_progress" for name in required)
    queued = sum(checks.get(name, {}).get("status") == "queued" for name in required)
    # Es avance de controles, no una predicción de tiempo: un trabajo en curso
    # cuenta como medio y uno en cola como apenas iniciado.
    percent = round(100 * (approved + 0.5 * active + 0.1 * queued) / len(required))
    return approved, active, queued, len(required) - approved, percent

print(f"Esperando CI {mode} del commit {commit[:12]}…", flush=True)
try:
    while True:
        try:
            checks = current_required(fetch_checks())
            api_errors = 0
        except RuntimeError as error:
            api_errors += 1
            elapsed = time.monotonic() - started
            print(f"GitHub no respondió ({error}). Reintento {api_errors} en {poll_seconds}s; esperando desde hace {clock(elapsed)}.", flush=True)
            time.sleep(poll_seconds)
            continue
        snapshot = tuple((name, label(checks.get(name))) for name in required)
        now = time.monotonic()
        if snapshot != last_snapshot or now - last_report >= 60:
            elapsed = now - started
            approved, active, queued, remaining, percent = progress(checks)
            print(f"CI {percent}% aprox. · {approved}/4 resueltos · faltan {remaining} · transcurrido {clock(elapsed)}:", flush=True)
            for name, state in snapshot:
                print(f"  - {name}: {state}", flush=True)
            if remaining:
                print(f"  GitHub no informa una ETA fiable. Hay {active} en proceso y {queued} en cola; próxima consulta en {poll_seconds}s.", flush=True)
            last_snapshot = snapshot
            last_report = now

        accepted = ("success", "skipped", "neutral") if mode == "fast" else ("success",)
        failed = [name for name in required if checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") not in accepted]
        if failed:
            for name in failed:
                url = checks[name].get("html_url")
                if url:
                    print(f"    Detalle de {name}: {url}", file=sys.stderr, flush=True)
            raise SystemExit("La CI falló; DEV no fue modificado: " + ", ".join(failed))

        if all(checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") in accepted for name in required):
            print("CI requerida resuelta correctamente. Continúa el despliegue seguro.", flush=True)
            break

        if timeout_seconds > 0 and now - started >= timeout_seconds:
            waiting = [name for name in required if label(checks.get(name)) != "aprobado"]
            raise SystemExit(
                f"La CI sigue pendiente después de {clock(timeout_seconds)}; DEV no fue modificado: "
                + ", ".join(waiting)
                + ". Podés repetir el mismo comando más tarde."
            )
        time.sleep(poll_seconds)
except KeyboardInterrupt:
    raise SystemExit("Espera cancelada por el operador; DEV no fue modificado. Podés repetir el mismo comando.")
PY
fi

mode=()
((CHECK_ONLY)) && mode+=(--check-only)
if [[ $DESTINATION != main ]]; then
  if ((CHECK_ONLY)); then
    installed=$(sudo python3 /opt/capibloques-environments/manage.py deployed "$DESTINATION")
    [[ $installed == "$target" ]] || { echo "ERROR: $DESTINATION está saludable pero no tiene la revisión remota solicitada ($installed)." >&2; exit 1; }
  else
    # Run the manager from the exact release, not an installed older copy with
    # another firmware version. Keep shared services and installed tools intact.
    umask 077
    REMOTE_SCRIPT=$(mktemp /tmp/capibloques-env-deploy.XXXXXX.py)
    git show "$target:ops/environments/manage.py" >"$REMOTE_SCRIPT"
    sudo python3 "$REMOTE_SCRIPT" deploy "$DESTINATION" --commit "$target" </dev/null
    # Keep the user's entry point current too. Atomic replacement leaves the
    # running Bash file intact and needs no root/shared-manager installation.
    launcher_directory=/home/capi/.local/bin
    mkdir -p "$launcher_directory"
    launcher_candidate=$(mktemp "$launcher_directory/.capi-dev.XXXXXX")
    if git show "$target:scripts/update-dev.sh" >"$launcher_candidate" && chmod 0755 "$launcher_candidate"; then
      mv -f "$launcher_candidate" "$launcher_directory/capi-dev"
    else
      rm -f "$launcher_candidate"
      echo 'ERROR: DEV se actualizó, pero no se pudo renovar el comando capi-dev.' >&2
      exit 1
    fi
  fi
  DEPLOY_CONFIRMED=1
  exit 0
fi
# El orquestador no se ejecuta desde stdin: varias herramientas de Docker
# aceptan entrada aunque no la necesiten y podrían consumir silenciosamente el
# resto del propio script, terminándolo con código cero antes del despliegue.
umask 077
REMOTE_SCRIPT=$(mktemp /tmp/capibloques-dev-deploy.XXXXXX)
git show "$target:scripts/deploy-dev-remote.sh" >"$REMOTE_SCRIPT"
if [[ -f /opt/capibloques-environments/manage.py ]] && ! ((CHECK_ONLY)) && ! grep -q '/run/capibloques-build.lock' "$REMOTE_SCRIPT"; then
  sudo python3 /opt/capibloques-environments/manage.py main-update --commit "$target" </dev/null
else
  sudo bash "$REMOTE_SCRIPT" --expected-commit "$target" "${mode[@]}" </dev/null
fi
DEPLOY_CONFIRMED=1
