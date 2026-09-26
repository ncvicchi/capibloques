import hashlib, json, pathlib, subprocess, sys, tempfile, unittest, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]

class PackageInterpreterTests(unittest.TestCase):
    def test_creates_deterministic_valid_shape(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); build = root / "build"; output = root / "published"; build.mkdir()
            names = {"0x1000":"boot.bin", "0x8000":"parts.bin", "0x10000":"app.bin"}
            (build / "flasher_args.json").write_text(json.dumps({"flash_files": names}), encoding="utf-8")
            for index, name in enumerate(names.values()): (build / name).write_bytes(bytes([index + 1]) * (64 + index))
            subprocess.run([sys.executable, str(ROOT / "scripts/package-interpreter-firmware.py"), "--profile", "wemos-d1-r32", "--build", str(build), "--output", str(output)], check=True, capture_output=True)
            info = json.loads((output / "wemos-d1-r32.json").read_text(encoding="utf-8")); bundle = output / info["bundle"]
            self.assertEqual(info["bytes"], bundle.stat().st_size)
            self.assertEqual(info["sha256"], hashlib.sha256(bundle.read_bytes()).hexdigest())
            with zipfile.ZipFile(bundle) as archive:
                self.assertEqual(archive.namelist(), ["manifest.json", "LEEME.txt", "firmware/part-0.bin", "firmware/part-1.bin", "firmware/part-2.bin"])
                manifest = json.loads(archive.read("manifest.json")); self.assertEqual(manifest["interpreter"], {"version":"1.5.4","abi":1})

if __name__ == "__main__": unittest.main()
