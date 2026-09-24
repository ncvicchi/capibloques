#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
: "${IDF_PATH:?Definí IDF_PATH o ejecutá primero export.sh de ESP-IDF}"
VERSION=${1:-1.4.0}
DEST=${2:-$ROOT/public/interpreter}
REVISION=${3:-unknown}
profile_is_current() {
  local profile=$1
  python3 - "$DEST" "$profile" "$VERSION" "$REVISION" <<'PY'
import hashlib, json, pathlib, sys

root = pathlib.Path(sys.argv[1])
profile, version, revision = sys.argv[2:]
try:
    info = json.loads((root / f"{profile}.json").read_text(encoding="utf-8"))
    bundle = root / info["bundle"]
    assert info["version"] == version
    assert info["sourceRevision"] == revision
    assert bundle.is_file() and bundle.stat().st_size == info["bytes"]
    assert hashlib.sha256(bundle.read_bytes()).hexdigest() == info["sha256"]
except Exception:
    raise SystemExit(1)
PY
}
build_profile() {
  local profile=$1 target=$2 board_define=$3 build="$ROOT/outputs/interpreter-$1"
  if profile_is_current "$profile"; then
    echo "Firmware intérprete $profile ya verificado; se reutiliza."
    return
  fi
  rm -rf "$build"
  IDF_TARGET="$target" idf.py -C "$ROOT/interpreter" -B "$build" -DIDF_TARGET="$target" -DSDKCONFIG="$build/sdkconfig" -DCAPI_BOARD_ID="$board_define" build
  python3 "$ROOT/scripts/package-interpreter-firmware.py" --profile "$profile" --build "$build" --output "$DEST" --version "$VERSION" --revision "$REVISION"
}
build_profile wemos-d1-r32 esp32 wemos-d1-r32
build_profile diymall-esp32-s3-devkitc-v1-n16r8 esp32s3 diymall-esp32-s3-devkitc-v1-n16r8
echo "Firmware intérprete $VERSION listo en $DEST"
