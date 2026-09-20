#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY=/home/capi/capibloques
CHECK_ONLY=0
TARGET_LABEL=desconocido
final_report() {
  local status=$?
  if ((status == 0)); then
    printf '\n============================================================\n'
    if ((CHECK_ONLY)); then
      printf 'RESULTADO: VERIFICACIÓN DEV COMPLETADA\n'
      printf 'Commit: %s\nEstado: auditoría correcta; no se hicieron cambios\n' "$TARGET_LABEL"
    else
      printf 'RESULTADO: DESPLIEGUE DEV COMPLETADO\n'
      printf 'Commit: %s\nEstado: listo para usar\n' "$TARGET_LABEL"
    fi
    printf '============================================================\n'
  else
    printf '\n============================================================\n' >&2
    if ((CHECK_ONLY)); then
      printf 'RESULTADO: VERIFICACIÓN DEV FALLÓ\n' >&2
    else
      printf 'RESULTADO: DESPLIEGUE DEV FALLÓ\n' >&2
    fi
    printf 'Commit objetivo: %s\nCódigo de salida: %s\nRevisá el último mensaje ERROR mostrado arriba.\n' "$TARGET_LABEL" "$status" >&2
    printf '============================================================\n' >&2
  fi
}
trap final_report EXIT

if [[ ${1:-} == --check-only ]]; then
  CHECK_ONLY=1
  shift
fi
[[ $# -eq 0 ]] || { echo "Uso: $0 [--check-only]" >&2; exit 2; }
[[ $(id -un) == capi ]] || { echo "Ejecutá esta orden como el usuario capi, sin sudo." >&2; exit 1; }
[[ $(hostname) == capi-dev ]] || { echo "Esta orden sólo funciona en capi-dev." >&2; exit 1; }

cd "$REPOSITORY"
[[ -z $(git status --porcelain) ]] || { echo "El checkout tiene cambios locales; no se actualizó." >&2; exit 1; }
git fetch --quiet origin main
target=$(git rev-parse origin/main)
TARGET_LABEL=${target:0:12}
git cat-file -e "$target:scripts/deploy-dev-remote.sh"

python3 - "$target" <<'PY'
import json
import os
import sys
import time
import urllib.error
import urllib.request

commit = sys.argv[1]
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
        return "aprobado" if conclusion == "success" else f"falló ({conclusion})"
    if status == "in_progress":
        return "en proceso"
    return f"pendiente ({status or 'sin estado'})"

def clock(seconds):
    seconds = max(0, int(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"

def progress(checks):
    approved = sum(checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") == "success" for name in required)
    active = sum(checks.get(name, {}).get("status") == "in_progress" for name in required)
    queued = sum(checks.get(name, {}).get("status") == "queued" for name in required)
    # Es avance de controles, no una predicción de tiempo: un trabajo en curso
    # cuenta como medio y uno en cola como apenas iniciado.
    percent = round(100 * (approved + 0.5 * active + 0.1 * queued) / len(required))
    return approved, active, queued, len(required) - approved, percent

print(f"Esperando la CI del commit {commit[:12]}…", flush=True)
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
            print(f"CI {percent}% aprox. · {approved}/4 aprobados · faltan {remaining} · transcurrido {clock(elapsed)}:", flush=True)
            for name, state in snapshot:
                print(f"  - {name}: {state}", flush=True)
            if remaining:
                print(f"  GitHub no informa una ETA fiable. Hay {active} en proceso y {queued} en cola; próxima consulta en {poll_seconds}s.", flush=True)
            last_snapshot = snapshot
            last_report = now

        failed = [name for name in required if checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") != "success"]
        if failed:
            for name in failed:
                url = checks[name].get("html_url")
                if url:
                    print(f"    Detalle de {name}: {url}", file=sys.stderr, flush=True)
            raise SystemExit("La CI falló; DEV no fue modificado: " + ", ".join(failed))

        if all(checks.get(name, {}).get("status") == "completed" and checks[name].get("conclusion") == "success" for name in required):
            print("CI completa y aprobada. Continúa el despliegue seguro.", flush=True)
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

mode=()
((CHECK_ONLY)) && mode+=(--check-only)
git show "$target:scripts/deploy-dev-remote.sh" | \
  sudo bash -s -- --expected-commit "$target" "${mode[@]}"
