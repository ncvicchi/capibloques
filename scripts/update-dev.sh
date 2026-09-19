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
import urllib.request

commit = sys.argv[1]
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
        checks = json.load(response)["check_runs"]
except Exception as error:
    raise SystemExit(f"No se pudo verificar la CI pública de GitHub: {error}")

required = {"backend", "verify", "esp-idf", "firmware"}
successful = {
    check.get("name")
    for check in checks
    if check.get("status") == "completed" and check.get("conclusion") == "success"
}
missing = sorted(required - successful)
if missing:
    raise SystemExit("El commit no tiene toda la CI verde: " + ", ".join(missing))
print(f"CI verificada para {commit}: " + ", ".join(sorted(required)))
PY

mode=()
((CHECK_ONLY)) && mode+=(--check-only)
git show "$target:scripts/deploy-dev-remote.sh" | \
  sudo bash -s -- --expected-commit "$target" "${mode[@]}"
