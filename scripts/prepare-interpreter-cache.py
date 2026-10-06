#!/usr/bin/env python3
"""Keep only compatible, target-local ESP-IDF objects; never clean the checkout."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def fingerprint(root, idf, target, toolchain_key):
    defaults = [root / "interpreter/sdkconfig.defaults"]
    if target == "esp32s3":
        defaults.append(root / "interpreter/sdkconfig.defaults.esp32s3")
    try:
        idf_revision = subprocess.check_output(
            ["git", "-C", str(idf), "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        idf_revision = hashlib.sha256((idf / "tools/idf.py").read_bytes()).hexdigest()
    tools = {}
    for name in ("xtensa-esp-elf-gcc", "xtensa-esp32-elf-gcc", "xtensa-esp32s3-elf-gcc", "cmake", "ninja"):
        executable = shutil.which(name)
        if executable:
            version = subprocess.check_output([executable, "--version"], text=True, stderr=subprocess.STDOUT)
            tools[name] = [str(Path(executable).resolve()), version.strip()]
    value = {
        "format": 1, "target": target, "project": str(root), "idf": str(idf),
        "idfRevision": idf_revision, "toolchain": toolchain_key,
        "tools": tools, "python": [sys.executable, sys.version],
        "defaults": [hashlib.sha256(path.read_bytes()).hexdigest() for path in defaults],
    }
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def prepare(root, idf, target, toolchain_key):
    if target not in ("esp32", "esp32s3"):
        raise ValueError("Target de caché desconocido.")
    root, idf = Path(root).resolve(), Path(idf).resolve()
    outputs = root / "outputs"
    cache = outputs / f"interpreter-{target}"
    # Refuse symlinks/junctions rather than recursively touching an unknown target.
    if outputs.is_symlink() or cache.is_symlink() or cache.resolve() != cache:
        raise ValueError("La caché debe estar dentro de outputs, sin enlaces simbólicos.")
    identity = fingerprint(root, idf, target, toolchain_key)
    marker = cache / ".capibloques-cache.json"
    previous = None
    if marker.is_file():
        try:
            previous = json.loads(marker.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    if cache.exists() and previous != {"identity": identity}:
        # Exact, validated generated directory; no sources, packages or secrets.
        shutil.rmtree(cache)
        print(f"Caché {target}: configuración/toolchain diferente o desconocida; reconstrucción inicial necesaria.", file=sys.stderr)
    elif (cache / "build.ninja").is_file():
        print(f"Caché {target}: objetos conservados; compilación incremental.", file=sys.stderr)
    else:
        print(f"Caché {target}: primera construcción; luego se conservarán los objetos.", file=sys.stderr)
    cache.mkdir(parents=True, exist_ok=True)
    temporary = cache / ".capibloques-cache.tmp"
    temporary.write_text(json.dumps({"identity": identity}), encoding="utf-8")
    temporary.replace(marker)
    return identity


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--idf", type=Path, required=True)
    parser.add_argument("--target", choices=("esp32", "esp32s3"), required=True)
    args = parser.parse_args()
    try:
        print(prepare(args.root, args.idf, args.target, os.environ.get("CAPI_INTERPRETER_TOOLCHAIN_KEY", "local")))
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"ERROR: no se pudo preparar la caché del intérprete: {error}") from error
