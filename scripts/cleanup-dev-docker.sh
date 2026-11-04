#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: la limpieza DEV requiere sudo." >&2; exit 1; }
[[ $(hostname) == capi-dev ]] || { echo "ERROR: esta limpieza sólo puede ejecutarse en capi-dev." >&2; exit 1; }

COMPILER_IMAGE=capibloques-compiler-dev:phase9
CACHE_BUDGET=${CAPI_DOCKER_CACHE_BUDGET:-4GB}
[[ $CACHE_BUDGET =~ ^[1-9][0-9]*(MB|GB)$ ]] || { echo 'ERROR: presupuesto de caché inválido (ejemplo 4GB).'; exit 1; }
declare -A keep=()

remember_image() {
  local reference=$1 image_id
  image_id=$(docker image inspect "$reference" --format '{{.Id}}' 2>/dev/null || true)
  if [[ $image_id =~ ^sha256:[0-9a-f]{64}$ ]]; then
    keep["$image_id"]=1
  fi

  # Las imágenes base son una optimización opcional. Si alguna todavía no fue
  # descargada, no debe convertir una limpieza correcta en un despliegue fallido.
  return 0
}

# Los contenedores activos definen las imágenes que mantienen DEV funcionando.
while IFS= read -r container; do
  [[ -n $container ]] || continue
  image_id=$(docker inspect "$container" --format '{{.Image}}')
  [[ $image_id =~ ^sha256:[0-9a-f]{64}$ ]] || {
    echo "ERROR: el contenedor $container no declara una imagen válida." >&2
    exit 1
  }
  keep["$image_id"]=1
done < <(docker ps -q)

# El compilador no queda corriendo como contenedor: hay que conservarlo de
# manera explícita. Las bases evitan volver a descargarlas en cada actualización.
remember_image "$COMPILER_IMAGE"
remember_image node:22.23.2-bookworm-slim
remember_image python:3.12-slim-bookworm
# Digest-pinned bases may not have a short tag. Preserve the exact references.
while IFS= read -r reference; do
  [[ -z $reference || $reference == *'$'* ]] || remember_image "$reference"
done < <(sed -n -E 's/^FROM ([^ ]+).*/\1/p' ops/public-dev/Dockerfile backend/Dockerfile ops/compiler/Dockerfile | sort -u)
# Preserve two most recently used content recipes per kind across environments.
while IFS= read -r reference; do
  [[ -z $reference ]] || remember_image "$reference"
done < <(python3 - <<'PY'
from pathlib import Path
import re
root = Path('/var/cache/capibloques-builds')
for kind in ('editor', 'api', 'compiler'):
    records = sorted(root.glob(kind+'-*.used'), key=lambda p: p.stat().st_mtime, reverse=True)
    for record in records[:2]:
        key = record.stem[len(kind)+1:]
        if re.fullmatch('[0-9a-f]{64}', key):
            print('capibloques-cache-'+kind+':'+key)
PY
)
# Idle sibling queues still require their immutable recipes and recovery images.
for environment in dev1 dev2; do
  while IFS= read -r reference; do
    [[ -z $reference ]] || remember_image "$reference"
  done < <(python3 - "$environment" <<'PY'
import json, pathlib, sys
root = pathlib.Path('/etc/capibloques/environments') / sys.argv[1]
for name in ('compiler.json', 'compose.json', 'previous-compose.json'):
    path = root / name
    if path.exists():
        info = json.loads(path.read_text())
        if name == 'compiler.json':
            print(info['image'])
        else:
            for service in info['services'].values():
                if service.get('image'):
                    print(service['image'])
PY
  )
done

[[ ${#keep[@]} -ge 4 ]] || {
  echo "ERROR: no se identificaron todas las imágenes indispensables de DEV." >&2
  exit 1
}

removed=0
while IFS= read -r image_id; do
  [[ -n $image_id ]] || continue
  [[ ${keep[$image_id]+yes} ]] && continue
  if docker image rm "$image_id" >/dev/null; then
    ((removed += 1))
  else
    echo "Aviso: Docker conservó $image_id porque todavía tiene una referencia." >&2
  fi
done < <(docker image ls -aq --no-trunc | sort -u)

# Retire old unused layers normally; under disk pressure evict LRU entries
# down to the configured budget. Never empty all warm build dependencies.
available_before=$(df -B1 --output=avail / | tail -n 1 | tr -d ' ')
if ((available_before < 4 * 1024 * 1024 * 1024)); then
  echo "Poco espacio: caché Docker limitada a $CACHE_BUDGET; SDK/objetos se conservan."
  docker builder prune --all --force --keep-storage "$CACHE_BUDGET" >/dev/null
else
  docker builder prune --all --force --filter until=168h --keep-storage "$CACHE_BUDGET" >/dev/null
fi

available=$(df -B1 --output=avail / | tail -n 1 | tr -d ' ')
[[ $available =~ ^[0-9]+$ ]] || {
  echo "ERROR: no se pudo medir el espacio libre después de limpiar." >&2
  exit 1
}
((available >= 2 * 1024 * 1024 * 1024)) || {
  echo "ERROR: DEV sigue con menos de 2 GiB libres después de limpiar." >&2
  exit 1
}

printf 'Limpieza Docker DEV: %s imágenes antiguas retiradas; caché conservada (presupuesto %s); libres %s.\n' \
  "$removed" "$CACHE_BUDGET" "$(df -h --output=avail / | tail -n 1 | tr -d ' ')"
