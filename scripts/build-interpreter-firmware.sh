#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
: "${IDF_PATH:?Definí IDF_PATH o ejecutá primero export.sh de ESP-IDF}"
VERSION=${1:-1.2.0}
DEST=${2:-$ROOT/public/interpreter}
REVISION=${3:-unknown}
build_profile() {
  local profile=$1 target=$2 board_define=$3 build="$ROOT/outputs/interpreter-$1"
  rm -rf "$build"
  idf.py -C "$ROOT/interpreter" -B "$build" -DIDF_TARGET="$target" -DSDKCONFIG="$build/sdkconfig" -DCAPI_BOARD_ID="$board_define" build
  python3 "$ROOT/scripts/package-interpreter-firmware.py" --profile "$profile" --build "$build" --output "$DEST" --version "$VERSION" --revision "$REVISION"
}
build_profile wemos-d1-r32 esp32 wemos-d1-r32
build_profile diymall-esp32-s3-devkitc-v1-n16r8 esp32s3 diymall-esp32-s3-devkitc-v1-n16r8
echo "Firmware intérprete $VERSION listo en $DEST"
