"""Pruebas del bootstrap; sólo archivos temporales, nunca secretos de la VM."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).with_name("init_dev_secrets.py")


class SecretBootstrapTests(unittest.TestCase):
    def run_script(self, directory):
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(directory)],
            capture_output=True, text=True, check=False,
        )

    def test_create_and_preserve_without_logging_values(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "secrets"
            first = self.run_script(directory)
            self.assertEqual(first.returncode, 0, first.stderr)
            before = {path.name: path.read_bytes() for path in directory.iterdir()}
            self.assertEqual(len(before), 3)
            second = self.run_script(directory)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(before, {path.name: path.read_bytes() for path in directory.iterdir()})
            for value in before.values():
                self.assertEqual(len(value.strip()), 128)
                self.assertNotIn(value.decode().strip(), first.stdout + second.stdout)
            if os.name == "posix":
                self.assertEqual(directory.stat().st_mode & 0o777, 0o700)
                for path in directory.iterdir():
                    self.assertEqual(path.stat().st_mode & 0o777, 0o444)

    def test_partial_set_is_not_completed_or_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            secret = directory / "django_key"
            secret.write_text("a" * 128, encoding="utf-8")
            result = self.run_script(directory)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(directory.iterdir()), [secret])
            self.assertEqual(secret.read_text(encoding="utf-8"), "a" * 128)

    def test_repo_and_ancestor_are_rejected(self):
        repo = SCRIPT.resolve().parents[1]
        for directory in (repo, repo / "never-create-secrets", repo.parent):
            with self.subTest(directory=str(directory)):
                self.assertNotEqual(self.run_script(directory).returncode, 0)

    @unittest.skipUnless(os.name == "posix", "Symlink creation requires extra privileges on Windows")
    def test_symlink_is_rejected_without_touching_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "secrets"
            directory.mkdir()
            target = Path(temporary) / "unrelated"
            target.write_text("original", encoding="utf-8")
            (directory / "django_key").symlink_to(target)
            self.assertNotEqual(self.run_script(directory).returncode, 0)
            self.assertEqual(target.read_text(encoding="utf-8"), "original")
            self.assertEqual(len(list(directory.iterdir())), 1)


if __name__ == "__main__":
    unittest.main()
