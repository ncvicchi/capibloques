"""Execute actual cleanup with fake Docker/df; never prune the host Docker."""
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.name != 'nt' and shutil.which('bash'), 'Linux shell doubles')
class CleanupTests(unittest.TestCase):
    def test_warm_images_and_sdk_are_preserved_and_prune_is_bounded(self):
        for available in (6*1024**3, 3*1024**3):
            with self.subTest(free=available), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                records = root/'records'
                records.mkdir()
                key = 'a'*64
                (records/('editor-'+key+'.used')).touch()
                kept = 'sha256:'+hashlib.sha256(('capibloques-cache-editor:'+key).encode()).hexdigest()
                sdk = 'sha256:'+hashlib.sha256(b'capibloques-compiler-dev:phase9').hexdigest()
                script = (ROOT/'scripts/cleanup-dev-docker.sh').read_text()
                script = re.sub(r'^\[\[ \$EUID .*?\n', '', script, flags=re.M)
                script = script.replace("Path('/var/cache/capibloques-builds')", f"Path('{records}')")
                (root/'cleanup.sh').write_text(script)
                for name in ('ops/public-dev/Dockerfile', 'backend/Dockerfile', 'ops/compiler/Dockerfile'):
                    path = root/name
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text('FROM example@sha256:'+'f'*64+'\n')
                log = root/'docker.log'
                bootstrap = r'''
hostname(){ printf capi-dev; }
df(){ if [[ $1 == -B1 ]]; then printf 'Avail\n%s\n' "$FREE"; else printf 'Avail\n6G\n'; fi; }
docker(){
  printf '%s\n' "$*" >> "$LOG"
  if [[ $1 == ps ]]; then printf 'active\n'
  elif [[ $1 == inspect ]]; then printf 'sha256:%064d\n' 1
  elif [[ $1 == image && $2 == inspect ]]; then printf 'sha256:'; printf '%s' "$3" | sha256sum | cut -d' ' -f1
  elif [[ $1 == image && $2 == ls ]]; then printf '%s\n%s\nsha256:obsolete\n' "$SDK" "$KEPT"
  fi
}
source ./cleanup.sh
'''
                result = subprocess.run(['bash', '-c', bootstrap], cwd=root, text=True, capture_output=True,
                    env=dict(os.environ, LOG=str(log), SDK=sdk, KEPT=kept, FREE=str(available)))
                self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
                lines = log.read_text().splitlines()
                self.assertNotIn('image rm '+sdk, lines)
                self.assertNotIn('image rm '+kept, lines)
                self.assertIn('image rm sha256:obsolete', lines)
                prune = [line for line in lines if line.startswith('builder prune')]
                self.assertEqual(len(prune), 1)
                self.assertIn('--keep-storage 4GB', prune[0])
                self.assertEqual('until=168h' in prune[0], available >= 4*1024**3)
                self.assertFalse(any('volume' in line or 'system prune' in line for line in lines))


if __name__ == '__main__':
    unittest.main()
