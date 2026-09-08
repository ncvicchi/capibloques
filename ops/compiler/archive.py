"""Fixed ESP32 4 MiB bundle. Addresses come from toolchain build metadata."""
import hashlib
import io
import json
from pathlib import Path
import shlex
import zipfile

FLASH_SIZE = 4 * 1024 * 1024


def bundle(build, framework, uses_wifi):
    build = Path(build).resolve(strict=True)
    if framework == "esp-idf":
        metadata = json.loads((build / "flasher_args.json").read_text())
        pairs = list(metadata["flash_files"].items())
        settings = metadata["flash_settings"]
        options = {"flashMode": settings["flash_mode"], "flashFrequency": settings["flash_freq"], "flashSize": settings["flash_size"]}
    else:
        # Arduino ESP32 emits the exact esptool arguments including boot_app0.
        args = shlex.split((build / "flash_args").read_text())
        pairs, options = [], {}
        names = {"--flash-mode": "flashMode", "--flash-freq": "flashFrequency", "--flash-size": "flashSize"}
        index = 0
        while index < len(args):
            token = args[index]
            if token in names:
                options[names[token]] = args[index + 1]; index += 2
            elif token.startswith("0x"):
                pairs.append((token, args[index + 1])); index += 2
            else:
                raise ValueError("Unexpected flash arguments")
    if options != {"flashMode": "dio", "flashFrequency": "40m", "flashSize": "4MB"}:
        raise ValueError("Unsupported flash settings")
    if not 3 <= len(pairs) <= 5:
        raise ValueError("Incomplete firmware")
    contents, parts, last = {}, [], 0
    for index, (offset, filename) in enumerate(sorted(pairs, key=lambda p: int(p[0], 0))):
        address = int(offset, 0)
        path = (build / filename).resolve(strict=True)
        if not path.is_relative_to(build) or path.suffix != ".bin":
            raise ValueError("Unexpected binary path")
        data = path.read_bytes()
        if not data or address < last or address + len(data) > FLASH_SIZE:
            raise ValueError("Invalid or overlapping flash range")
        last = address + len(data)
        name = f"firmware/part-{index}.bin"
        contents[name] = data
        parts.append({"path": name, "offset": address, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    if parts[0]["offset"] != 0x1000 or not any(p["offset"] == 0x8000 for p in parts) or not any(p["offset"] == 0x10000 for p in parts):
        raise ValueError("Missing ESP32 bootloader, partitions or application")
    manifest = {"format": "CapiBloquesFirmware", "version": 1, "board": "wemos-d1-r32", "chip": "esp32", "framework": framework,
                "frameworkVersion": "5.5.5" if framework == "esp-idf" else "3.3.11", "containsWifiCredentials": uses_wifi, **options, "parts": parts}
    contents["manifest.json"] = json.dumps(manifest, indent=2).encode()
    if framework == "esp-idf":
        for name in ("Adafruit-GFX.txt", "Arduino-GFX.txt"):
            contents["licenses/" + name] = (build.parent / "project" / "licenses" / name).read_bytes()
    arguments = " ".join(f"0x{part['offset']:x} {part['path']}" for part in parts)
    contents["LEEME.txt"] = ("CapiBloques · Firmware completo para Wemos D1 R32 (ESP32, no ESP32-S3).\n"
        "Revisá cableado, alimentación y parada física con una persona adulta. Desconectá motores antes de grabar.\n"
        "Extraer TODO el ZIP. Con esptool instalado en tu PC:\n"
        f"python -m esptool --chip esp32 --port PUERTO write-flash --flash-mode dio --flash-freq 40m --flash-size 4MB {arguments}\n"
        "Reemplazar PUERTO (por ejemplo COM4 o /dev/ttyUSB0). El programa reemplaza el anterior. No borrar toda la flash/NVS automáticamente.\n"
        "USB desde la web se agrega en la siguiente fase. Compilar no demuestra seguridad eléctrica ni funcionamiento físico.\n"
        + ("PRIVADO: este firmware contiene la contraseña Wi-Fi. No compartirlo. Retirarlo del servidor no borra copias descargadas ni la placa. Para quitar la clave de la placa, reemplazar este firmware por uno sin ella.\n" if uses_wifi else "")).encode()
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for name, data in contents.items():
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0)); info.external_attr = 0o600 << 16
            archive.writestr(info, data)
    if output.tell() > 5_000_000:
        raise ValueError("Firmware too large")
    return output.getvalue()
