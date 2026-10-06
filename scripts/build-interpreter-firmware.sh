#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
: "${IDF_PATH:?Definí IDF_PATH o ejecutá primero export.sh de ESP-IDF}"
VERSION=${1:-1.8.0}
DEST=${2:-$ROOT/public/interpreter}
REVISION=${3:-unknown}
if command -v ccache >/dev/null 2>&1; then
  export IDF_CCACHE_ENABLE=1
  export CCACHE_DIR="$ROOT/outputs/interpreter-ccache"
  export CCACHE_MAXSIZE=256M
  echo "ccache habilitado y persistente (máximo 256 MB)."
else
  export IDF_CCACHE_ENABLE=0
  echo "Compilación incremental habilitada; ccache no está instalado (no se reconstruye la imagen para instalarlo)."
fi
profile_is_current() {
  local profile=$1 identity=$2
  python3 - "$DEST" "$profile" "$VERSION" "$REVISION" "$identity" <<'PY'
import hashlib, json, pathlib, sys

root = pathlib.Path(sys.argv[1])
profile, version, revision, identity = sys.argv[2:]
try:
    info = json.loads((root / f"{profile}.json").read_text(encoding="utf-8"))
    bundle = root / info["bundle"]
    assert info["version"] == version
    assert info["sourceRevision"] == revision
    assert info.get("buildIdentity") == identity
    assert bundle.is_file() and bundle.stat().st_size == info["bytes"]
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == info["sha256"]
except Exception:
    raise SystemExit(1)
PY
}
build_profile() {
  local profile=$1 target=$2 board_define=$3 build="$ROOT/outputs/interpreter-$2" identity
  identity=$(python3 "$ROOT/scripts/prepare-interpreter-cache.py" --root "$ROOT" --idf "$IDF_PATH" --target "$target")
  if profile_is_current "$profile" "$identity"; then
    echo "Firmware intérprete $profile ya verificado; se reutiliza."
    return
  fi
  local defaults="$ROOT/interpreter/sdkconfig.defaults"
  if [[ $target == esp32s3 ]]; then defaults="$defaults;$ROOT/interpreter/sdkconfig.defaults.esp32s3"; fi
  IDF_TARGET="$target" idf.py -C "$ROOT/interpreter" -B "$build" -DIDF_TARGET="$target" -DSDKCONFIG="$build/sdkconfig" -DSDKCONFIG_DEFAULTS="$defaults" -DCAPI_BOARD_ID="$board_define" build
  python3 "$ROOT/scripts/package-interpreter-firmware.py" --profile "$profile" --build "$build" --output "$DEST" --version "$VERSION" --revision "$REVISION" --build-identity "$identity"
}
build_profile wemos-d1-r32 esp32 wemos-d1-r32
# DIYmall y Waveshare usan el mismo target/toolchain. La segunda configuración
# recompila la app con otro CAPI_BOARD_ID, pero reutiliza los objetos de ESP-IDF.
build_profile diymall-esp32-s3-devkitc-v1-n16r8 esp32s3 diymall-esp32-s3-devkitc-v1-n16r8
build_profile waveshare-esp32-s3-touch-lcd-5-28117 esp32s3 waveshare-esp32-s3-touch-lcd-5-28117
echo "Firmware intérprete $VERSION listo en $DEST"
