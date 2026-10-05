"""Exercise the deployer's actual audit selection against real Git histories."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = shutil.which("bash") or ("C:/Program Files/Git/bin/bash.exe" if os.name == "nt" else None)


@unittest.skipUnless(BASH, "Bash required")
class DeployResumeTests(unittest.TestCase):
    def test_interrupted_update_audits_commits_even_after_checkout_advanced(self):
        source = (ROOT / "scripts/deploy-dev-remote.sh").read_text()
        block = source[source.index("AUDIT_BASE=$CURRENT_COMMIT"):source.index("RUN_MIGRATIONS=0")]
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(["git", *args], cwd=directory, text=True).strip()
            git("init", "-q")
            git("config", "user.name", "Deploy test")
            git("config", "user.email", "deploy@example.invalid")
            commits = []
            for name in ("initial", "pending", "backend-change", "latest"):
                Path(directory, name).write_text(name)
                git("add", name)
                git("commit", "-qm", name)
                commits.append(git("rev-parse", "HEAD"))
            git("checkout", "-q", commits[0])
            git("commit", "--allow-empty", "-qm", "divergent")
            divergent = git("rev-parse", "HEAD")
            for current, pending, expected in (
                (commits[0], commits[1], {"pending", "backend-change", "latest"}),
                (commits[2], commits[1], {"backend-change", "latest"}),
                (commits[3], commits[1], {"backend-change", "latest"}),
                (commits[1], commits[1], {"backend-change", "latest"}),
                (divergent, commits[1], None),
                (commits[2], divergent, None),
            ):
                with self.subTest(current=current, pending=pending):
                    Path(directory, "state").write_text(f"target={pending}\n")
                    env = dict(os.environ, CURRENT_COMMIT=current, TARGET_COMMIT=commits[3], STATE_FILE="state")
                    result = subprocess.run([BASH, "-c", 'set -e; repo_git(){ git "$@"; }; fail(){ echo "$*" >&2; exit 1; };\n' + block + '\nprintf "%s\\n" "$changed_files"'], cwd=directory, env=env, text=True, capture_output=True)
                    if expected is None:
                        self.assertNotEqual(result.returncode, 0)
                    else:
                        self.assertEqual(result.returncode, 0, result.stderr)
                        self.assertEqual(set(result.stdout.splitlines()), expected)


if __name__ == "__main__":
    unittest.main()
