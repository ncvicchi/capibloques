"""Pure runner/archive contract tests; never Docker, user accounts or hardware."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
import zipfile

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "ops/compiler"))
from archive import bundle

# Windows has no flock; do not replace it in production, only for importing
# pure argument/validation helpers in this non-executing test process.
if sys.platform == "win32":
    import types
    sys.modules["fcntl"] = types.SimpleNamespace()
import runner


class FirmwareIsolationTests(unittest.TestCase):
    def test_no_host_mounts_secrets_network_or_privileges(self):
        args = runner.create_arguments(str(uuid.uuid4()), "sha256:" + "a" * 64)
        for forbidden in ("--privileged", "--volume", "-v", "--mount", "--env", "-e", "/var/run/docker.sock"):
            self.assertNotIn(forbidden, args)
        for key, value in (("--network", "none"), ("--user", "10000:10000"), ("--cap-drop", "ALL"), ("--pids-limit", "128"), ("--memory", "1024m"), ("--memory-swap", "1600m"), ("--log-driver", "none")):
            self.assertEqual(args[args.index(key)+1], value)
        self.assertIn("--read-only", args)
        self.assertRaises(ValueError, runner.create_arguments, str(uuid.uuid4()), "mutable:latest")
        self.assertRaises(ValueError, runner.create_arguments, "../../outside", "sha256:" + "a" * 64)

    def fixture(self, directory, framework):
        directory = Path(directory)
        for name in ("boot.bin", "partitions.bin", "app.bin"):
            (directory / name).write_bytes(b"synthetic-firmware" * 10)
        if framework == "arduino":
            (directory / "boot_app0.bin").write_bytes(b"synthetic-boot-app")
            (directory / "flash_args").write_text("--flash-mode dio --flash-freq 40m --flash-size 4MB\n0x1000 boot.bin\n0x8000 partitions.bin\n0xe000 boot_app0.bin\n0x10000 app.bin\n")
        else:
            (directory / "flasher_args.json").write_text(json.dumps({"flash_files": {"0x1000": "boot.bin", "0x8000": "partitions.bin", "0x10000": "app.bin"}, "flash_settings": {"flash_mode": "dio", "flash_freq": "40m", "flash_size": "4MB"}}))
            licenses = directory.parent / "project/licenses"; licenses.mkdir(parents=True, exist_ok=True)
            for name in ("Adafruit-GFX.txt", "Arduino-GFX.txt"): (licenses / name).write_text("Synthetic license")

    def test_full_manifest_hashes_fixed_offsets_and_credential_warning(self):
        for framework in ("arduino", "esp-idf"):
            with tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary) / "build"; directory.mkdir()
                self.fixture(directory, framework)
                raw = bundle(directory, framework, True)
                job = {"id": str(uuid.uuid4()), "attempt": str(uuid.uuid4()), "recipe": "a" * 64, "framework": framework, "wifi": {"ssid": "synthetic", "password": "test-only"}}
                published = runner.validate_archive(raw, job)
                with zipfile.ZipFile(io.BytesIO(published)) as archive:
                    manifest = json.loads(archive.read("manifest.json"))
                    self.assertEqual(manifest["recipe"], job["recipe"])
                    self.assertEqual(manifest["parts"][-1]["offset"], 0x10000)
                    self.assertTrue(manifest["containsWifiCredentials"])
                    self.assertNotIn(b"test-only", archive.read("manifest.json"))
                    self.assertIn(b"PRIVADO", archive.read("LEEME.txt"))
                self.assertRaises(ValueError, runner.validate_archive, raw, {**job, "framework": "foreign"})
                self.assertRaises(ValueError, runner.validate_archive, raw, {**job, "wifi": None})

    def test_path_overlap_and_wrong_flash_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "build"; directory.mkdir()
            self.fixture(directory, "arduino")
            args = directory / "flash_args"
            text = args.read_text()
            args.write_text(text.replace("0x8000", "0x1000"))
            self.assertRaises(ValueError, bundle, directory, "arduino", False)
            args.write_text(text.replace("4MB", "8MB"))
            self.assertRaises(ValueError, bundle, directory, "arduino", False)
            outside = Path(temporary) / "outside.bin"; outside.write_bytes(b"x")
            args.write_text(text.replace("app.bin", "../outside.bin"))
            self.assertRaises(ValueError, bundle, directory, "arduino", False)


if __name__ == "__main__": unittest.main()
