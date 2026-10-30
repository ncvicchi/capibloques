#!/usr/bin/env bash
set -Eeuo pipefail
[[ $(hostname) == capi-dev3 && $(id -un) == capi ]] || { echo 'Sólo usuario capi en capi-dev3, sin sudo.' >&2; exit 1; }
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
export PATH="$HOME/.local/share/capibloques-dev3/npm/node_modules/.bin:$PATH"
compose() { docker compose --ansi never -f "$ROOT/compose.dev3.yaml" "$@"; }
case ${1:-status} in
  setup)
    if (( $(npm --version | cut -d. -f1) < 11 )); then
      npm install --prefix "$HOME/.local/share/capibloques-dev3/npm" npm@11.10.0 --no-save --no-audit --no-fund
      hash -r
    fi
    python3 - <<'PY'
import os, pathlib, secrets
root = pathlib.Path.home()/'.config/capibloques-dev3'
root.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(root, 0o700)
for name in ('django_key', 'db_admin_password', 'db_app_password'):
    path = root/name
    if not path.exists():
        descriptor = os.open(path, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
        with os.fdopen(descriptor, 'w') as target: target.write(secrets.token_hex(64)+'\n')
    if len(path.read_text().strip()) < 64: raise SystemExit('Secreto existente inválido; no se reemplazó: '+name)
    # Compose mounts files with their host modes. Private parent protects the
    # host; read-only 0444 mounts allow postgres (999) and API (1000) to read.
    os.chmod(path, 0o444)
(pathlib.Path.home()/'.local/share/capibloques-dev3/artifacts').mkdir(mode=0o700, parents=True, exist_ok=True)
PY
    mkdir -p work
    dependency_key=$( { sha256sum package-lock.json; node --version; npm --version; } | sha256sum | cut -d' ' -f1)
    if [[ ! -d node_modules || ! -f work/dev3-node.key || $(cat work/dev3-node.key) != "$dependency_key" ]]; then
      npm ci --no-audit --no-fund
      printf '%s\n' "$dependency_key" > work/dev3-node.key
    fi
    compose up -d --build db api
    compose exec -T api python manage.py migrate --noinput
    mkdir -p "$HOME/.config/systemd/user"
    cat > "$HOME/.config/systemd/user/capibloques-dev3-editor.service" <<UNIT
[Unit]
Description=CapiBloques DEV3 editor con HMR
After=network-online.target
[Service]
WorkingDirectory=$ROOT
ExecStart=/usr/bin/bash $ROOT/scripts/dev3.sh editor
Restart=on-failure
RestartSec=3
[Install]
WantedBy=default.target
UNIT
    systemctl --user daemon-reload
    systemctl --user enable --now capibloques-dev3-editor.service
    echo 'DEV3 preparado. Editor: localhost:3003 mediante túnel SSH. Los datos existentes se conservaron.'
    ;;
  editor)
    export CAPIBLOQUES_API_TARGET=http://127.0.0.1:8003
    export CAPIBLOQUES_LOCAL_DEV=1
    exec npm run dev -- --host 127.0.0.1 --port 3003 --strictPort
    ;;
  up)
    compose up -d db api
    systemctl --user start capibloques-dev3-editor.service
    ;;
  down)
    systemctl --user stop capibloques-dev3-editor.service
    compose stop api db
    ;;
  status)
    compose ps
    systemctl --user --no-pager status capibloques-dev3-editor.service
    curl --fail --silent --show-error http://127.0.0.1:3003/api/health/ready/
    ;;
  logs) journalctl --user -u capibloques-dev3-editor.service -f ;;
  api) shift; compose exec api python manage.py "$@" ;;
  migrate) compose exec -T api python manage.py migrate --noinput ;;
  admin) compose exec api python manage.py bootstrap_admin ;;
  firmware)
    # Primera vez descarga SDK; después conserva objetos y ccache en outputs.
    mkdir -p outputs
    exec 9> outputs/dev3-firmware.lock
    flock -n 9 || { echo 'Ya hay una compilación de firmware en curso.' >&2; exit 75; }
    version=$(sed -n 's/^#define CAPI_FIRMWARE_VERSION "\([0-9.]*\)"$/\1/p' interpreter/main/main.cpp)
    # Development must also rebuild uncommitted C++/header edits. HEAD alone
    # would incorrectly reuse the previous binary until a commit was created.
    revision=$(python3 - <<'PY'
import hashlib, pathlib
root = pathlib.Path('interpreter')
digest = hashlib.sha256()
for path in sorted(root.rglob('*')):
    if path.is_file() and path.name not in ('sdkconfig', 'sdkconfig.old'):
        digest.update(str(path.relative_to(root)).encode()+b'\0'+path.read_bytes()+b'\0')
print(digest.hexdigest())
PY
)
    image=espressif/idf:v5.5.5@sha256:a9231d0697ab8f7517cc072e93b7c83e04907bfbfba80b6440d7dbbf90665cf2
    docker image inspect "$image" >/dev/null 2>&1 || docker pull "$image"
    docker run --rm --cpus 6 --memory 8g --user "$(id -u):$(id -g)" -e HOME=/tmp/capi-idf -e IDF_PY_BUILD_JOBS=6 \
      -v "$ROOT:/project" -w /project "$image" bash -lc ". \"\$IDF_PATH/export.sh\" >/dev/null && bash scripts/build-interpreter-firmware.sh '$version' /project/public/interpreter '$revision'"
    ;;
  *) echo 'Uso: ./scripts/dev3.sh setup|up|down|status|logs|migrate|admin|api COMANDO|firmware' >&2; exit 2 ;;
esac
