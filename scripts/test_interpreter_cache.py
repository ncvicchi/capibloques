"""Regression tests for persistent ESP-IDF cache and interrupted builds."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("interpreter_cache", ROOT / "scripts/prepare-interpreter-cache.py")
cache_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cache_module)
BASH = shutil.which("bash") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else None)


class InterpreterCacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "interpreter").mkdir()
        (self.root / "interpreter/sdkconfig.defaults").write_text("CONFIG_A=y\n")
        (self.root / "interpreter/sdkconfig.defaults.esp32s3").write_text("CONFIG_SPIRAM=y\n")
        self.idf = self.root / "idf"
        (self.idf / "tools").mkdir(parents=True)
        (self.idf / "tools/idf.py").write_text("fake IDF version")
        # The cache identity tests isolate the installed tools from the host.
        self.addCleanup(patch.stopall)
        patch.object(cache_module.shutil, "which", return_value=None).start()
        self.git = patch.object(cache_module.subprocess, "check_output", return_value="idf-v1\n").start()

    def prepare(self, target="esp32", key="image-v1"):
        return cache_module.prepare(self.root, self.idf, target, key)

    def objects(self, target="esp32"):
        path = self.root / f"outputs/interpreter-{target}"
        (path / "driver.obj").write_text("compiled library")
        (path / "build.ninja").write_text("build graph")
        return path

    def test_main_change_preserves_libraries_sdkconfig_and_target_cache(self):
        original = self.prepare()
        cache = self.objects()
        (cache / "sdkconfig").write_text("generated settings")
        (self.root / "interpreter/main.cpp").write_text("changed application")
        self.assertEqual(self.prepare(), original)
        self.assertEqual((cache / "driver.obj").read_text(), "compiled library")
        self.assertEqual((cache / "sdkconfig").read_text(), "generated settings")

    def test_s3_board_switch_shares_libraries(self):
        original = self.prepare("esp32s3")
        cache = self.objects("esp32s3")
        self.assertEqual(self.prepare("esp32s3"), original)
        self.assertTrue((cache / "driver.obj").exists())

    def test_defaults_change_invalidates_only_the_affected_target(self):
        wemos = self.prepare()
        self.objects()
        s3 = self.prepare("esp32s3")
        s3_cache = self.objects("esp32s3")
        (self.root / "interpreter/sdkconfig.defaults.esp32s3").write_text("CONFIG_SPIRAM=n\n")
        self.assertEqual(self.prepare(), wemos)
        self.assertNotEqual(self.prepare("esp32s3"), s3)
        self.assertFalse((s3_cache / "driver.obj").exists())
        self.assertTrue((self.root / "outputs/interpreter-esp32/driver.obj").exists())

    def test_toolchain_change_resets_only_generated_objects(self):
        original = self.prepare()
        cache = self.objects()
        sentinel = self.root / "keep.txt"
        sentinel.write_text("source/user data")
        self.assertNotEqual(self.prepare(key="image-v2"), original)
        self.assertFalse((cache / "driver.obj").exists())
        self.assertEqual(sentinel.read_text(), "source/user data")

    def test_idf_revision_change_invalidates(self):
        original = self.prepare()
        cache = self.objects()
        self.git.return_value = "idf-v2\n"
        self.assertNotEqual(self.prepare(), original)
        self.assertFalse((cache / "driver.obj").exists())

    def test_failed_partial_build_can_resume_without_losing_objects(self):
        original = self.prepare()
        cache = self.objects()
        (cache / "incomplete-app.obj").write_text("partial")
        self.assertEqual(self.prepare(), original)
        self.assertTrue((cache / "driver.obj").exists())

    def test_corrupt_marker_rebuilds_known_target(self):
        self.prepare()
        cache = self.objects()
        (cache / ".capibloques-cache.json").write_text("broken")
        self.prepare()
        self.assertFalse((cache / "driver.obj").exists())

    def test_refuses_unknown_target(self):
        with self.assertRaises(ValueError):
            self.prepare("../../escape")

    def test_refuses_symlink_cache_without_touching_destination(self):
        (self.root / "outputs").mkdir()
        outside = self.root / "unrelated"
        outside.mkdir()
        (outside / "keep.txt").write_text("keep")
        try:
            (self.root / "outputs/interpreter-esp32").symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Host does not allow directory symlinks")
        with self.assertRaises(ValueError):
            self.prepare()
        self.assertEqual((outside / "keep.txt").read_text(), "keep")


@unittest.skipUnless(BASH, "Bash required")
class BuilderIntegrationTests(unittest.TestCase):
    def test_repeated_script_builds_keep_idf_objects_and_same_revision_skips(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "scripts").mkdir()
            for name in ("build-interpreter-firmware.sh", "prepare-interpreter-cache.py", "package-interpreter-firmware.py"):
                shutil.copyfile(ROOT / "scripts" / name, root / "scripts" / name)
            (root / "interpreter").mkdir()
            for name in ("sdkconfig.defaults", "sdkconfig.defaults.esp32s3"):
                (root / "interpreter" / name).write_text("CONFIG_DUMMY=y\n")
            (root / "idf/tools").mkdir(parents=True)
            (root / "idf/tools/idf.py").write_text("dummy IDF revision")
            (root / "fake-bin").mkdir()
            # This double only creates build artifacts. It does NOT emulate ESP-IDF.
            (root / "fake-idf.py").write_text('''import json, pathlib, sys
args=sys.argv[1:]; build=pathlib.Path(args[args.index("-B")+1]); build.mkdir(parents=True, exist_ok=True)
library=build/"driver.obj"
if not library.exists(): library.write_text("one SDK compilation")
(build/"build.ninja").write_text("graph")
board=next(value.split("=",1)[1] for value in args if value.startswith("-DCAPI_BOARD_ID="))
fail=pathlib.Path("fail-next")
if board.startswith("diymall") and fail.exists(): fail.unlink(); sys.exit(7)
files={"0x1000" if "s3" not in board else "0x0":"boot.bin", "0x8000":"part.bin", "0x10000":"app.bin"}
for name in files.values(): (build/name).write_bytes(board.encode())
(build/"flasher_args.json").write_text(json.dumps({"flash_files":files}))
with (build.parent/"calls.txt").open("a") as output: output.write(board+"\\n")
''')
            wrapper = root / "fake-bin/idf.py"
            wrapper.write_text('#!/usr/bin/env bash\nexec python3 "$PWD/fake-idf.py" "$@"\n')
            wrapper.chmod(0o755)
            environment = dict(os.environ, CAPI_INTERPRETER_TOOLCHAIN_KEY="test-image", IDF_CCACHE_ENABLE="0")
            command = 'export PATH="$PWD/fake-bin:$PATH"; export IDF_PATH="$PWD/idf"; bash scripts/build-interpreter-firmware.sh 1.8.0 "$PWD/published" '
            def run(revision):
                result = subprocess.run([BASH, "-c", command + revision], cwd=root, env=environment, text=True, capture_output=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return result.stdout
            run("rev-one")
            libraries = [root / f"outputs/interpreter-{target}/driver.obj" for target in ("esp32", "esp32s3")]
            before = [path.stat().st_mtime_ns for path in libraries]
            run("rev-two")
            self.assertEqual([path.stat().st_mtime_ns for path in libraries], before)
            self.assertEqual(len((root / "outputs/calls.txt").read_text().splitlines()), 6)
            self.assertIn("ya verificado; se reutiliza", run("rev-two"))
            self.assertEqual(len((root / "outputs/calls.txt").read_text().splitlines()), 6)
            info = json.loads((root / "published/wemos-d1-r32.json").read_text())
            self.assertEqual(len(info["buildIdentity"]), 64)
            (root / "fail-next").write_text("simulate interrupted S3 build")
            failed = subprocess.run([BASH, "-c", command + "rev-three"], cwd=root, env=environment, text=True, capture_output=True)
            self.assertEqual(failed.returncode, 7, failed.stdout + failed.stderr)
            run("rev-three")
            self.assertEqual([path.stat().st_mtime_ns for path in libraries], before)


if __name__ == "__main__":
    unittest.main()
