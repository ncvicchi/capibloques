#!/usr/bin/env python3
"""Create immutable Web Serial bundles from completed ESP-IDF builds."""
import argparse, hashlib, json, pathlib, zipfile

PROFILES = {
    "wemos-d1-r32": {"chip": "esp32", "flashMode": "dio", "flashFrequency": "40m", "flashSize": "4MB"},
    "diymall-esp32-s3-devkitc-v1-n16r8": {"chip": "esp32s3", "flashMode": "qio", "flashFrequency": "80m", "flashSize": "16MB"},
}

def digest(data): return hashlib.sha256(data).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=PROFILES, required=True)
    parser.add_argument("--build", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    parser.add_argument("--version", default="1.2.0")
    parser.add_argument("--revision", default="unknown")
    args = parser.parse_args()
    metadata = json.loads((args.build / "flasher_args.json").read_text(encoding="utf-8"))
    flash_files = metadata.get("flash_files", {})
    expected = [0x1000, 0x8000, 0x10000] if PROFILES[args.profile]["chip"] == "esp32" else [0, 0x8000, 0x10000]
    selected = []
    for offset in expected:
        name = flash_files.get(str(offset)) or flash_files.get(hex(offset))
        if not name: raise SystemExit(f"missing flash part at {hex(offset)}")
        path = args.build / name
        data = path.read_bytes()
        selected.append((offset, data))
    recipe = digest(b"".join(data for _, data in selected))
    settings = PROFILES[args.profile]
    manifest = {"format":"CapiBloquesFirmware","version":1,"board":args.profile,"chip":settings["chip"],"framework":"esp-idf","containsWifiCredentials":False,"flashMode":settings["flashMode"],"flashFrequency":settings["flashFrequency"],"flashSize":settings["flashSize"],"recipe":recipe,"interpreter":{"version":args.version,"abi":1},"parts":[]}
    for index, (offset, data) in enumerate(selected): manifest["parts"].append({"path":f"firmware/part-{index}.bin","offset":offset,"size":len(data),"sha256":digest(data)})
    args.output.mkdir(parents=True, exist_ok=True)
    bundle = args.output / f"{args.profile}-{args.version}.zip"
    with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, separators=(",",":"), sort_keys=True).encode())
        archive.writestr("LEEME.txt", f"Intérprete CapiBloques {args.version} para {args.profile}.\n")
        for index, (_, data) in enumerate(selected): archive.writestr(f"firmware/part-{index}.bin", data)
    info = {"board":args.profile,"version":args.version,"abi":1,"bundle":bundle.name,"bytes":bundle.stat().st_size,"sha256":digest(bundle.read_bytes()),"sourceRevision":args.revision}
    (args.output / f"{args.profile}.json").write_text(json.dumps(info, separators=(",",":"), sort_keys=True), encoding="utf-8")
    print(json.dumps(info))

if __name__ == "__main__": main()
