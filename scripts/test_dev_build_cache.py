"""Build invalidation, bundle corruption, and optional real Docker reuse."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), ROOT/'scripts'/f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


images = load('dev-build-cache')
artifacts = load('interpreter-artifact-cache')


def write(root, name, value):
    path = root/name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value)


class CacheTests(unittest.TestCase):
    def fixture(self, root):
        for name, text in {
            'app/page.tsx': 'page', 'lib/program.ts': 'logic', 'docs/notes.md': 'notes',
            'backend/Dockerfile': 'FROM scratch\nCOPY . /app\n', 'backend/api.py': 'api',
            'ops/public-dev/Dockerfile': 'FROM scratch\nCOPY app /app\nCOPY lib /lib\nCOPY public /public\n',
        }.items():
            write(root, name, text)
        for profile in images.PROFILES:
            directory = root/'public/interpreter'
            directory.mkdir(parents=True, exist_ok=True)
            data = profile.encode()
            (directory/(profile+'.zip')).write_bytes(data)
            write(root, 'public/interpreter/'+profile+'.json', json.dumps(dict(
                board=profile, bundle=profile+'.zip', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())))

    def key(self, root, kind):
        tracked = [p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()]
        files, _ = images.inputs(root, kind, tracked)
        return images.fingerprint(files, kind, {})

    def test_only_real_inputs_invalidate_and_old_bundles_do_not(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            editor, api = self.key(root, 'editor'), self.key(root, 'api')
            write(root, 'docs/notes.md', 'new docs')
            write(root, 'public/interpreter/obsolete-1.0.zip', 'old binary')
            self.assertEqual(self.key(root, 'editor'), editor)
            self.assertEqual(self.key(root, 'api'), api)
            write(root, 'app/page.tsx', 'new page')
            self.assertNotEqual(self.key(root, 'editor'), editor)
            self.assertEqual(self.key(root, 'api'), api)
            write(root, 'backend/api.py', 'new api')
            self.assertNotEqual(self.key(root, 'api'), api)

    def test_build_keys_survive_paths_timestamps_and_invalidate_sdk(self):
        with tempfile.TemporaryDirectory() as temporary:
            roots = [Path(temporary)/name for name in ('checkout', 'another-release')]
            for root in roots:
                self.fixture(root)
            os.utime(roots[1]/'app/page.tsx', (1000, 1000))
            self.assertEqual(self.key(roots[0], 'editor'), self.key(roots[1], 'editor'))
            self.assertNotEqual(images.fingerprint({'a': b'same'}, 'compiler', {'sdk': 'old'}),
                                images.fingerprint({'a': b'same'}, 'compiler', {'sdk': 'new'}))

    def test_rejects_corrupt_bundle_and_unknown_copy_syntax(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            (root/'public/interpreter'/f'{images.PROFILES[0]}.zip').write_bytes(b'bad')
            with self.assertRaisesRegex(ValueError, 'inválido'):
                self.key(root, 'editor')
        with self.assertRaises(ValueError):
            images.copy_sources('FROM scratch\nADD https://example.org/file /app\n')
        with self.assertRaises(ValueError):
            images.copy_sources('COPY ["file", "/file"]')
        with self.assertRaises(ValueError):
            images.copy_sources('COPY ../secret /app')

    def test_artifact_reuse_requires_recipe_toolchain_and_complete_valid_set(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in ('build-interpreter-firmware.sh', 'prepare-interpreter-cache.py',
                         'package-interpreter-firmware.py', 'interpreter-artifact-cache.py'):
                write(root, 'scripts/'+name, name)
            version, revision = '1.15.0', 'a'*40
            key = artifacts.recipe_key(root, version, revision, 'sdk1')
            source, target, cache = root/'source', root/'target', root/'cache'
            source.mkdir()
            for profile in artifacts.PROFILES:
                data = profile.encode()
                (source/(profile+'.zip')).write_bytes(data)
                (source/(profile+'.json')).write_text(json.dumps(dict(board=profile, version=version,
                    sourceRevision=revision, abi=1, recipeKey=key, bundle=profile+'.zip', bytes=len(data),
                    sha256=hashlib.sha256(data).hexdigest())))
            self.assertTrue(artifacts.operate('store', root, cache, source, version, revision, 'sdk1'))
            self.assertTrue(artifacts.operate('restore', root, cache, target, version, revision, 'sdk1'))
            before = (target/(artifacts.PROFILES[0]+'.zip')).read_bytes()
            self.assertFalse(artifacts.operate('restore', root, cache, target, version, revision, 'sdk2'))
            (cache/key/(artifacts.PROFILES[-1]+'.zip')).write_bytes(b'broken')
            self.assertFalse(artifacts.operate('restore', root, cache, target, version, revision, 'sdk1'))
            self.assertEqual((target/(artifacts.PROFILES[0]+'.zip')).read_bytes(), before)
            write(root, 'scripts/package-interpreter-firmware.py', 'changed recipe')
            self.assertNotEqual(artifacts.recipe_key(root, version, revision, 'sdk1'), key)

    @unittest.skipUnless(os.environ.get('CAPI_TEST_DOCKER') == '1', 'Opt-in: real Docker on DEV3, no services')
    def test_real_images_reuse_payload_across_revisions_and_rebuild_after_edit(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write(root, 'backend/Dockerfile', 'FROM scratch\nCOPY value.txt /value.txt\n')
            write(root, 'backend/value.txt', 'first')
            subprocess.run(['git', 'init', '-q', str(root)], check=True)
            subprocess.run(['git', '-C', str(root), 'add', '.'], check=True)
            target = 'capibloques-cache-test:'+str(os.getpid())
            keys = []
            try:
                with patch.object(images, 'compose_build', wraps=images.compose_build) as builds:
                    keys.append(images.build(root, 'api', target, 'a'*40, root/'cache'))
                    self.assertEqual(builds.call_count, 2)
                    write(root, 'notes.md', 'documentation only')
                    keys.append(images.build(root, 'api', target, 'b'*40, root/'cache'))
                    self.assertEqual(keys[0], keys[1])
                    self.assertEqual(builds.call_count, 3)  # metadata only, no application build
                    self.assertEqual(images.inspect(target)['Config']['Labels']['org.opencontainers.image.revision'], 'b'*40)
                    write(root, 'backend/value.txt', 'second')
                    keys.append(images.build(root, 'api', target, 'c'*40, root/'cache'))
                    self.assertNotEqual(keys[0], keys[2])
                    self.assertEqual(builds.call_count, 5)
            finally:
                subprocess.run(['docker', 'image', 'rm', target], check=False)
                for key in set(keys):
                    subprocess.run(['docker', 'image', 'rm', 'capibloques-cache-api:'+key], check=False)


if __name__ == '__main__':
    unittest.main()
