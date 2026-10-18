#!/usr/bin/env bash
# Explicit one-time installation, from the published infrastructure worktree.
set -Eeuo pipefail
[[ $(id -un) == capi && $(hostname) == capi-dev ]] || { echo 'Ejecutar como capi en capi-dev, sin sudo.' >&2; exit 1; }
source_root=$(cd "$(dirname "$0")/.." && pwd)
repository=/home/capi/capibloques
lock_directory=/home/capi/.local/state/capibloques
mkdir -p "$lock_directory"
exec 9>>"$lock_directory/dev-operation.lock"
flock -n 9 || { echo 'DEV OCUPADO; no se inició instalación.' >&2; exit 75; }
[[ -z $(git -C "$source_root" status --porcelain) ]] || { echo 'La fuente de instalación tiene cambios locales.' >&2; exit 1; }
revision=$(git -C "$source_root" rev-parse HEAD)
git -C "$repository" fetch --quiet origin
sudo python3 "$source_root/ops/environments/manage.py" install
# Long-lived environments start with this infrastructure, never force existing
# branches or merge anything into main during setup.
for environment in dev1 dev2; do
  if ! git -C "$repository" show-ref --verify --quiet "refs/remotes/origin/$environment"; then
    git -C "$repository" push origin "$revision:refs/heads/$environment"
  fi
done
mkdir -p /home/capi/.local/bin
install -m 0755 "$source_root/scripts/update-dev.sh" /home/capi/.local/bin/capi-dev
echo 'LISTO: actualizador instalado en /home/capi/.local/bin/capi-dev. Main no fue publicado ni actualizado.'
echo 'Siguiente: ~/.local/bin/capi-dev --env dev1; luego --env dev2. DNS/TLS se configuran en el edge.'
