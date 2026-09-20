#!/usr/bin/env bash
set -Eeuo pipefail

REPOSITORY=/home/capi/capibloques
CHECK_ONLY=0
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
git cat-file -e "$target:scripts/deploy-dev-remote.sh"

python3 - "$target" <<'PY'
import json
import sys
import time
import urllib.error
import urllib.request

commit = sys.argv[1]
required = ("backend", "verify", "esp-idf", "firmware")
poll_seconds = 45
timeout_seconds = 30 * 60
started = time.monotonic()
last_snapshot = None
last_report = 0.0

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
        raise SystemExit(f"No se pudo consultar la CI de GitHub: HTTP {error.code}{detail}")
    except Exception as error:
        raise SystemExit(f"No se pudo consultar la CI de GitHub: {error}")

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

print(f"Esperando la CI del commit {commit[:12]}…", flush=True)
try:
    while True:
        checks = current_required(fetch_checks())
        snapshot = tuple((name, label(checks.get(name))) for name in required)
        now = time.monotonic()
        if snapshot != last_snapshot or now - last_report >= 180:
            elapsed = int(now - started)
            print(f"CI después de {elapsed // 60:02d}:{elapsed % 60:02d}:", flush=True)
            for name, state in snapshot:
                print(f"  - {name}: {state}", flush=True)
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

        if now - started >= timeout_seconds:
            waiting = [name for name in required if label(checks.get(name)) != "aprobado"]
            raise SystemExit(
                "La CI sigue pendiente después de 30 minutos; DEV no fue modificado: "
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
