"""Real local Git histories and concurrent processes; no SSH, sudo or Docker."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASH = shutil.which("bash") or ("C:/msys64/usr/bin/bash.exe" if Path("C:/msys64/usr/bin/bash.exe").exists() else None)
GIT = shutil.which("git")


@unittest.skipUnless(BASH and GIT, "Bash, flock and Git required")
class UpdateDevTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.remote = self.root / "origin.git"
        self.seed = self.root / "seed"
        self.repo = self.root / "operational"
        self.lock = self.root / "locks"
        self.marker = self.root / "runtime-called"
        self.release = self.root / "release"
        self.git(self.root, "init", "--bare", "-q", str(self.remote))
        self.git(self.root, "init", "-q", "-b", "main", str(self.seed))
        self.identity(self.seed)
        (self.seed / "scripts").mkdir()
        (self.seed / "scripts/deploy-dev-remote.sh").write_text(
            '#!/usr/bin/env bash\nset -eu\n'
            'git -C "$TEST_REPO" rev-parse HEAD >"$TEST_MARKER"\n'
            'if [[ ${TEST_HOLD:-0} == 1 ]]; then\n'
            '  while [[ ! -e $TEST_RELEASE ]]; do sleep 0.05; done\nfi\n'
            'exit "${TEST_DEPLOY_EXIT:-0}"\n', encoding="utf-8")
        (self.seed / "shared").write_text("base\n")
        self.git(self.seed, "add", ".")
        self.git(self.seed, "commit", "-qm", "initial")
        self.base = self.git(self.seed, "rev-parse", "HEAD")
        self.git(self.seed, "remote", "add", "origin", str(self.remote))
        self.git(self.seed, "push", "-qu", "origin", "main")
        self.git(self.seed, "push", "-q", "origin", "main:dev1", "main:dev2")
        self.git(self.root, "clone", "-q", "-b", "main", str(self.remote), str(self.repo))
        self.identity(self.repo)
        self.git(self.seed, "switch", "-qc", "codex/task")
        (self.seed / "feature").write_text("feature\n")
        self.git(self.seed, "add", ".")
        self.git(self.seed, "commit", "-qm", "feature")
        self.feature = self.git(self.seed, "rev-parse", "HEAD")
        self.git(self.seed, "push", "-qu", "origin", "codex/task")
        self.script = self.root / "update.sh"
        source = (ROOT / "scripts/update-dev.sh").read_text(encoding="utf-8")
        source = source.replace("REPOSITORY=/home/capi/capibloques", f"REPOSITORY='{self.repo.as_posix()}'")
        source = source.replace("LOCK_DIRECTORY=/home/capi/.local/state/capibloques", f"LOCK_DIRECTORY='{self.lock.as_posix()}'")
        source = source.replace("/home/capi/capibloques-integracion-XXXXXX", f"{self.root.as_posix()}/integration-XXXXXX")
        self.script.write_text(source, encoding="utf-8")
        self.bootstrap = self.root / "test-env.sh"
        self.bootstrap.write_text(
            'export PATH="/usr/bin:$PATH"\n'
            'id(){ printf capi; }\nhostname(){ printf capi-dev; }\n'
            'find(){ return 0; }\n'
            'git(){\n'
            '  if [[ ${TEST_REJECT_PUSH:-0} == 1 && " $* " == *" push "* ]]; then return 1; fi\n'
            f'  "{Path(GIT).as_posix()}" "$@"\n'
            '}\n'
            'sudo(){\n'
            ' if [[ $1 == python3 ]]; then\n'
            '   if [[ $3 == deployed ]]; then printf "%s\\n" "${TEST_DEPLOYED:-invalid}"; return; fi\n'
            '   [[ $3 == deploy ]] || return 90\n'
            '   bash "$TEST_HELPER"; return\n'
            ' fi\n'
            ' [[ $1 == bash ]] || return 90; shift; bash "$@"; }\n', encoding="utf-8")
        self.env = dict(os.environ, BASH_ENV=self.bootstrap.as_posix(), TEST_REPO=self.repo.as_posix(),
                        TEST_MARKER=self.marker.as_posix(), TEST_RELEASE=self.release.as_posix(),
                        TEST_HELPER=(self.seed / "scripts/deploy-dev-remote.sh").as_posix(),
                        GIT_TERMINAL_PROMPT="0", LC_ALL="C.UTF-8")

    def git(self, cwd, *args):
        return subprocess.check_output([GIT, *args], cwd=cwd, text=True, encoding="utf-8", stderr=subprocess.PIPE).strip()

    def identity(self, repo):
        self.git(repo, "config", "user.name", "Local test")
        self.git(repo, "config", "user.email", "test@example.invalid")

    def run_update(self, *args, **environment):
        return subprocess.run([BASH, str(self.script), *args], env=dict(self.env, **environment), text=True,
                              encoding="utf-8", errors="replace", capture_output=True, timeout=30)

    def merge_args(self):
        return ("--env", "dev1", "--branch", "codex/task", "--commit", self.feature, "--fast")

    def test_merge_push_and_update_without_advancing_operational_head(self):
        result = self.run_update(*self.merge_args())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("ACTUALIZACIÓN DEV COMPLETADA", result.stdout)
        self.assertEqual(self.marker.read_text().strip(), self.base, "runtime must audit from the old HEAD")
        self.assertEqual(self.git(self.repo, "rev-parse", "HEAD"), self.base)
        merged = self.git(self.remote, "rev-parse", "dev1")
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        self.assertEqual(self.git(self.remote, "rev-parse", "dev2"), self.base)
        self.git(self.remote, "merge-base", "--is-ancestor", self.feature, merged)
        self.assertFalse(list(self.root.glob("integration-*")))
        self.assertFalse((self.lock / "dev-operation.info").exists())
        retry = self.run_update(*self.merge_args())
        self.assertEqual(retry.returncode, 0, retry.stdout + retry.stderr)
        self.assertIn("ya está integrada", retry.stdout)
        self.assertEqual(self.git(self.remote, "rev-parse", "dev1"), merged)

    def test_wrong_sha_and_dirty_checkout_do_not_publish_or_call_runtime(self):
        result = self.run_update("--env", "dev1", "--branch", "codex/task", "--commit", "0" * 40)
        self.assertNotEqual(result.returncode, 0)
        (self.repo / "private-work").write_text("preserve this")
        dirty = self.run_update(*self.merge_args())
        self.assertNotEqual(dirty.returncode, 0)
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        self.assertFalse(self.marker.exists())
        self.assertEqual((self.repo / "private-work").read_text(), "preserve this")

    def test_conflict_preserves_worktree_without_touching_operational_checkout(self):
        (self.seed / "shared").write_text("feature version\n")
        self.git(self.seed, "add", ".")
        self.git(self.seed, "commit", "-qm", "feature conflict")
        feature = self.git(self.seed, "rev-parse", "HEAD")
        self.git(self.seed, "push", "-q", "origin", "codex/task")
        self.git(self.seed, "switch", "-q", "main")
        (self.seed / "shared").write_text("main version\n")
        self.git(self.seed, "add", ".")
        self.git(self.seed, "commit", "-qm", "main conflict")
        main = self.git(self.seed, "rev-parse", "HEAD")
        self.git(self.seed, "push", "-q", "origin", "main:dev1")
        result = self.run_update("--env", "dev1", "--branch", "codex/task", "--commit", feature)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Copia conservada", result.stderr)
        self.assertEqual(self.git(self.remote, "rev-parse", "dev1"), main)
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        self.assertEqual(self.git(self.repo, "rev-parse", "HEAD"), self.base)
        self.assertEqual(self.git(self.repo, "status", "--porcelain"), "")
        self.assertTrue(list(self.root.glob("integration-*/worktree/shared")))
        self.assertFalse(self.marker.exists())

    def test_rejected_push_and_runtime_failure_are_distinguished(self):
        rejected = self.run_update(*self.merge_args(), TEST_REJECT_PUSH="1")
        self.assertNotEqual(rejected.returncode, 0)
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        self.assertFalse(self.marker.exists())
        failed = self.run_update(*self.merge_args(), TEST_DEPLOY_EXIT="7")
        self.assertEqual(failed.returncode, 7)
        self.assertIn("ya se publicó en dev1", failed.stderr)
        self.assertIn("ACTUALIZACIÓN DEV FALLÓ", failed.stderr)
        self.assertNotEqual(self.git(self.remote, "rev-parse", "dev1"), self.base)
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)

    def test_second_operation_is_rejected_until_the_first_finishes(self):
        first = subprocess.Popen([BASH, str(self.script), *self.merge_args()], env=dict(self.env, TEST_HOLD="1"),
                                 text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            deadline = time.monotonic() + 20
            while not self.marker.exists() and first.poll() is None and time.monotonic() < deadline:
                time.sleep(0.05)
            self.assertTrue(self.marker.exists(), "first operation did not reach runtime")
            info = (self.lock / "dev-operation.info").read_text()
            for args in ((), self.merge_args()):
                second = self.run_update(*args)
                self.assertEqual(second.returncode, 75, second.stdout + second.stderr)
                self.assertIn("DEV OCUPADO", second.stderr)
                self.assertEqual((self.lock / "dev-operation.info").read_text(), info)
        finally:
            self.release.touch()
            output, error = first.communicate(timeout=20)
        self.assertEqual(first.returncode, 0, output + error)
        self.assertTrue((self.lock / "dev-operation.lock").exists(), "never unlink the lock inode")
        self.assertFalse((self.lock / "dev-operation.info").exists())
        self.assertEqual(self.run_update().returncode, 0, "lock released after completion")


    def test_usage_help_and_git_guards(self):
        help_result = self.run_update("--help")
        self.assertEqual(help_result.returncode, 0)
        self.assertIn("--branch", help_result.stdout)
        for args in (("--branch",), ("--commit", self.feature), ("--branch", "main"),
                     ("--branch", "codex/task", "--check-only"), ("--branch", "bad..ref")):
            result = self.run_update(*args)
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
        missing = self.run_update("--env", "dev1", "--branch", "codex/missing")
        self.assertNotEqual(missing.returncode, 0)
        self.git(self.repo, "switch", "-qc", "codex/local")
        branch = self.run_update()
        self.assertNotEqual(branch.returncode, 0)
        self.assertIn("debe estar en main", branch.stderr)
        self.git(self.repo, "switch", "-q", "main")
        (self.repo / ".git/CHERRY_PICK_HEAD").write_text(self.feature + "\n")
        pending = self.run_update()
        self.assertNotEqual(pending.returncode, 0)
        self.assertIn("operación Git pendiente", pending.stderr)
        self.assertFalse(self.marker.exists())
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)

    def test_promotion_requires_healthy_installed_tip_and_is_explicit(self):
        result = self.run_update(*self.merge_args())
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        installed = self.git(self.remote, "rev-parse", "dev1")
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        rejected = self.run_update("--promote", "dev1", TEST_DEPLOYED=self.base)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertEqual(self.git(self.remote, "rev-parse", "main"), self.base)
        promoted = self.run_update("--promote", "dev1", "--commit", installed, TEST_DEPLOYED=installed)
        self.assertEqual(promoted.returncode, 0, promoted.stdout + promoted.stderr)
        self.git(self.remote, "merge-base", "--is-ancestor", installed, "main")
        self.assertEqual(self.git(self.repo, "rev-parse", "HEAD"), self.base)
        self.assertEqual(self.git(self.remote, "rev-parse", "dev2"), self.base)


if __name__ == "__main__":
    unittest.main()
