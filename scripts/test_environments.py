"""Fast local contracts. No Docker/SSH, no disk changes outside temporary dirs."""
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT/path)
    module = importlib.util.module_from_spec(spec)
    if sys.platform == 'win32':
        with patch.dict(sys.modules, fcntl=Mock()):
            spec.loader.exec_module(module)
    else:
        spec.loader.exec_module(module)
    return module


manager = load('environment_manager', 'ops/environments/manage.py')
seeder = load('environment_seeder', 'ops/environments/seed.py')


class EnvironmentTests(unittest.TestCase):
    def test_fixture_comparison_normalizes_only_zero_timestamp_not_program_text(self):
        a = [{'model': 'projects.project', 'pk': 'id', 'fields': {
            'created_at': '2026-10-18T00:00:00.000Z', 'document': {'text': 'data.000Z'}}}]
        b = json.loads(json.dumps(a))
        b[0]['fields']['created_at'] = '2026-10-18T00:00:00Z'
        self.assertEqual(seeder.comparable(json.dumps(a)), seeder.comparable(json.dumps(b)))
        b[0]['fields']['document']['text'] = 'dataZ'
        self.assertNotEqual(seeder.comparable(json.dumps(a)), seeder.comparable(json.dumps(b)))

    def test_seed_checks_schema_not_unrelated_scene_validation_changes(self):
        runtime = Mock()
        runtime.git.return_value = 'same'
        seeder.check_schema(runtime, 'target')
        paths = [call.args[1] for call in runtime.git.call_args_list]
        self.assertIn('HEAD:backend/projects/models.py', paths)
        self.assertIn('target:backend/projects/migrations', paths)
        self.assertNotIn('HEAD:backend/projects/validation.py', paths)
        runtime.git.side_effect = ['old', 'new']
        with self.assertRaisesRegex(RuntimeError, 'compatibilidad'):
            seeder.check_schema(runtime, 'target')

    def test_seed_contains_only_application_data_never_sessions_or_jobs(self):
        fixture = json.dumps([{'model': 'accounts.user', 'pk': 'uuid', 'fields': {}},
                              {'model': 'projects.project', 'pk': 'uuid', 'fields': {}}])
        self.assertEqual(seeder.validate_fixture(fixture), {'accounts.user': 1, 'projects.project': 1})
        for forbidden in ('sessions.session', 'compiler.build', 'compiler.compilerconfig'):
            with self.assertRaises(ValueError):
                seeder.validate_fixture(json.dumps([{'model': forbidden}]))
        self.assertIn('REPEATABLE READ, READ ONLY', seeder.SNAPSHOT_CODE)

    def test_layout_is_disjoint_and_main_is_never_accepted(self):
        a, b = manager.layout('dev1'), manager.layout('dev2')
        for key in ('project', 'fqdn', 'port', 'local', 'subnet', 'web', 'api', 'directory', 'data'):
            self.assertNotEqual(a[key], b[key], key)
        self.assertEqual(a['port'], 3081)
        self.assertEqual(b['port'], 3082)
        for invalid in ('main', 'prd', '../../main', 'dev3'):
            with self.assertRaises(ValueError):
                manager.layout(invalid)

    def test_config_is_immutable_scoped_and_does_not_reuse_secrets_or_volumes(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            original = dict(name='capibloques-dev', services={
                'editor': {'image': 'old'}, 'api': {'image': 'old', 'volumes': [{'source': '/main/backend'}]},
                'db': {'image': 'postgres:pinned'}}, volumes={'pgdata': {'name': 'capibloques-dev_pgdata'}},
                networks={'default': {'name': 'capibloques-dev_default'}})
            source = directory/'source'
            (source/'ops/public-dev').mkdir(parents=True)
            (source/'ops/public-dev/firewall.sh').write_text((ROOT/'ops/public-dev/firewall.sh').read_text())
            with patch.object(manager, 'BASE', directory/'config'), patch.object(manager, 'DATA', directory/'data'), \
                 patch.object(manager, 'FIREWALL_TEMPLATE', source/'ops/public-dev/firewall.sh'), \
                 patch.object(manager, 'settings', return_value={}), \
                 patch.object(manager.os, 'chown', create=True), \
                 patch.object(manager, 'run', return_value=json.dumps(original)), patch.object(manager, 'compose'):
                results = []
                for env in ('dev1', 'dev2'):
                    spec = manager.layout(env)
                    config = json.loads(manager.create_config(spec, source, 'a'*40).read_text())
                    self.assertEqual(config['name'], 'capibloques-'+env)
                    self.assertEqual(config['volumes']['pgdata']['name'], 'capibloques-'+env+'_pgdata')
                    self.assertEqual(config['networks']['default']['name'], 'capibloques-'+env+'_default')
                    api = config['services']['api']
                    self.assertNotIn('/main/backend', json.dumps(api['volumes']))
                    self.assertTrue(api['volumes'][0]['read_only'])
                    self.assertIn(env, api['image'])
                    results.append((spec['directory']/'secrets/django_key').read_text())
                    firewall = (spec['directory']/'firewall.sh').read_text()
                    self.assertNotIn('CHAIN=CAPIBLOQUES_DEV_IN\n', firewall)
                    self.assertIn('project=capibloques-'+env, firewall)
                    self.assertNotIn('/etc/capibloques/public-dev.env', firewall)
                self.assertNotEqual(*results)

    def test_compose_dispatch_has_fixed_project_and_root_config(self):
        with patch.object(manager, 'run', return_value='{}') as call:
            manager.manage(manager.layout('dev2'), 'compiler_dispatch', 'inspect', capture=True)
        command = [str(x).replace('\\', '/') for x in call.call_args.args]
        self.assertIn('capibloques-dev2', command)
        self.assertIn('/etc/capibloques/environments/dev2/compose.json', command)
        self.assertNotIn('compose.dev.yaml', command)

    def test_each_runner_ignores_other_queues_and_keeps_legacy_main_names(self):
        for env in ('main', 'dev1', 'dev2'):
            with patch.dict(os.environ, CAPIBLOQUES_COMPILER_ENV=env):
                runner = load('runner_'+env, 'ops/compiler/runner.py')
            attempt = '00000000-0000-0000-0000-000000000001'
            prefix = 'capi-build-' if env == 'main' else f'capi-{env}-build-'
            own = {'Name': '/'+prefix+attempt, 'Config': {'Labels': {} if env == 'main' else {runner.ENV_LABEL: env}}}
            other = {'Name': '/unexpected-name-from-other-env', 'Config': {'Labels': {runner.ENV_LABEL: 'dev2' if env != 'dev2' else 'main'}}}
            with patch.object(runner, 'docker', side_effect=[b'one two', json.dumps([own]).encode(), json.dumps([other]).encode()]):
                self.assertEqual(list(runner.inventory()), [prefix+attempt])
            args = runner.create_arguments(attempt, 'sha256:'+'a'*64)
            self.assertIn(runner.ENV_LABEL+'='+env, args)
            self.assertNotIn('--volume', args)
            self.assertEqual(runner.name(attempt), prefix+attempt)

    def test_new_environment_runner_never_dispatches_into_main_api(self):
        with patch.dict(os.environ, CAPIBLOQUES_COMPILER_ENV='dev1'):
            runner = load('runner_dev1_dispatch', 'ops/compiler/runner.py')
        with patch.object(runner.subprocess, 'run', return_value=Mock(returncode=0, stdout=b'{}')) as call:
            runner.dispatch({'checkout': '/releases/a', 'compose': '/etc/dev1/compose.json'}, 'inspect')
        args = call.call_args.args[0]
        self.assertIn('capibloques-dev1', args)
        self.assertIn('/etc/dev1/compose.json', args)
        self.assertNotIn('compose.dev.yaml', args)

    def test_backup_and_pending_markers_precede_migration_and_publication(self):
        # Fail-closed ordering is supplementary to the execution tests above.
        source = (ROOT/'ops/environments/manage.py').read_text()
        deploy = source[source.index('def deploy('):source.index('def main():')]
        self.assertLess(deploy.index("atomic(pending"), deploy.index("'migrate', '--noinput'"))
        self.assertLess(deploy.index('healthy(spec)'), deploy.index("/'deployed'"))
        self.assertNotIn("'down'", deploy)
        self.assertNotIn('volume rm', deploy)
        self.assertNotIn('systemctl\', \'stop\', \'capibloques-dev-web', deploy)

    def test_active_image_must_match_declared_revision_not_just_healthy_http(self):
        with tempfile.TemporaryDirectory() as temporary:
            spec = manager.layout('dev1')
            spec['directory'] = Path(temporary)
            (spec['directory']/'compose.json').write_text(json.dumps({'services': {
                'editor': {'image': 'editor:a'}, 'api': {'image': 'api:a'}}}))
            def execute(*args, **kwargs):
                if args[1] == 'inspect':
                    service = args[2]
                    return json.dumps([{'State': {'Running': True}, 'Image': 'sha256:a',
                                        'Config': {'Image': service+':a', 'Labels': {'org.opencontainers.image.revision': 'a'*40}}}])
                return 'sha256:a\n'
            with patch.object(manager, 'compose', side_effect=lambda spec, *args, **kwargs: args[-1]+'\n'), \
                 patch.object(manager, 'run', side_effect=execute):
                manager.verify_active(spec, 'a'*40)
                with self.assertRaisesRegex(RuntimeError, 'commit instalado'):
                    manager.verify_active(spec, 'b'*40)

    def test_unchanged_interpreter_reuses_verified_bundles_without_building(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            main = directory/'main'
            source = main/'public/interpreter'
            source.mkdir(parents=True)
            for profile in manager.PROFILES:
                raw = profile.encode()
                (source/(profile+'.zip')).write_bytes(raw)
                (source/(profile+'.json')).write_text(json.dumps(dict(bundle=profile+'.zip', bytes=len(raw),
                    sha256=hashlib.sha256(raw).hexdigest(), sourceRevision='tree-id', version='1.9.0')))
            with patch.object(manager, 'REPO', main), patch.object(manager, 'git', return_value='tree-id'), \
                 patch.object(manager.os, 'chown', create=True), patch.object(manager, 'run') as run:
                manager.firmware(directory/'release', 'a'*40)
            run.assert_not_called()
            self.assertEqual(len(list((directory/'release/public/interpreter').glob('*.json'))), 3)

    def test_missing_existing_database_secret_is_not_regenerated(self):
        with tempfile.TemporaryDirectory() as temporary:
            spec = manager.layout('dev1')
            spec['directory'] = Path(temporary)/'config'
            spec['data'] = Path(temporary)/'data'
            with patch.object(manager, 'settings', return_value={}), \
                 patch.object(manager, 'run', return_value='capibloques-dev1_pgdata\n'):
                with self.assertRaisesRegex(RuntimeError, 'NO regenerarlo'):
                    manager.create_config(spec, Path(temporary), 'a'*40)
            self.assertFalse((spec['directory']/'secrets/django_key').exists())


if __name__ == '__main__':
    unittest.main()
