#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: la limpieza DEV requiere sudo." >&2; exit 1; }
[[ $(hostname) == capi-dev ]] || { echo "ERROR: esta limpieza sólo puede ejecutarse en capi-dev." >&2; exit 1; }

COMPILER_IMAGE=capibloques-compiler-dev:phase9
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

# La caché de construcción es regenerable y llegó a ocupar más de 8 GB en la
# VM de 31 GB. Se retira completa después de validar el nuevo runtime.
docker builder prune --all --force >/dev/null

available=$(df -B1 --output=avail / | tail -n 1 | tr -d ' ')
[[ $available =~ ^[0-9]+$ ]] || {
  echo "ERROR: no se pudo medir el espacio libre después de limpiar." >&2
  exit 1
}
((available >= 2 * 1024 * 1024 * 1024)) || {
  echo "ERROR: DEV sigue con menos de 2 GiB libres después de limpiar." >&2
  exit 1
}

printf 'Limpieza Docker DEV: %s imágenes antiguas retiradas; caché de build vacía; libres %s.\n' \
  "$removed" "$(df -h --output=avail / | tail -n 1 | tr -d ' ')"
