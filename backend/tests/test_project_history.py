import copy
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from projects.models import Project, ProjectRevision, ProjectDeletion, ProjectEvent
from .test_accounts import FAST_HASHERS
from .test_projects import ProjectTests, EXAMPLES


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class HistoryTests(TestCase):
    setUp = ProjectTests.setUp
    payload = ProjectTests.payload
    create = ProjectTests.create
    url = ProjectTests.url
    action = ProjectTests.action

    def save(self, project, name, automatic=False):
        sample = copy.deepcopy(EXAMPLES[0]); sample['metadata']['title'] = name
        return self.client.put(self.url(project), {'operationId': str(uuid.uuid4()), 'revision': project['revision'], 'document': sample}, content_type='application/json', HTTP_X_CAPI_SAVE_MODE='automatic' if automatic else 'manual')

    def versions(self, project):
        return self.client.get(self.url(project, 'history')).json()['versions']

    def test_manual_history_restore_creates_new_revision_and_replay_is_bound_to_target(self):
        original = self.create()
        project = self.save(original, 'Después').json()['project']
        self.assertEqual([v['revision'] for v in self.versions(project)], [2, 1])
        self.assertEqual(self.client.get(self.url(project, 'history/1')).json()['document'], EXAMPLES[0])
        payload = {'operationId': str(uuid.uuid4()), 'revision': 2}
        first = self.client.post(self.url(project, 'history/1/restore'), payload, content_type='application/json')
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(first.json()['project']['revision'], 3)
        self.assertEqual(Project.objects.get().document, EXAMPLES[0])
        self.assertEqual(self.client.post(self.url(project, 'history/1/restore'), payload, content_type='application/json').json(), first.json())
        self.assertEqual(self.client.post(self.url(project, 'history/2/restore'), payload, content_type='application/json').status_code, 409)
        self.assertEqual(ProjectEvent.objects.filter(action='history_restored').count(), 1)
        self.assertEqual([v['revision'] for v in self.versions(project)], [3, 2, 1])

    def test_automatic_checkpoints_are_periodic_not_every_keystroke(self):
        project = self.create()
        for i in range(6):
            project = self.save(project, f'Auto {i}', True).json()['project']
        self.assertEqual([v['revision'] for v in self.versions(project)], [7, 1])
        Project.objects.filter(pk=project['id']).update(last_checkpoint_at=timezone.now() - timedelta(minutes=6))
        project = self.save(project, 'Punto periódico', True).json()['project']
        project = self.save(project, 'Siguiente', True).json()['project']
        self.assertEqual([v['revision'] for v in self.versions(project)], [9, 8, 1])

    def test_retention_preserves_twenty_plus_pinned_and_quota_failure_rolls_back(self):
        project = self.create()
        project = self.save(project, 'Dos').json()['project']
        ProjectRevision.objects.filter(revision=1).update(pinned=True)
        for i in range(24):
            project = self.save(project, f'Manual {i}').json()['project']
        self.assertEqual(len(self.versions(project)), 21)
        self.assertTrue(ProjectRevision.objects.filter(revision=1, pinned=True).exists())
        before = list(ProjectRevision.objects.values_list('revision', flat=True))
        with patch('projects.history.MAX_HISTORY_BYTES', 1):
            self.assertEqual(self.save(project, 'No guardar').status_code, 400)
        self.assertEqual(list(ProjectRevision.objects.values_list('revision', flat=True)), before)
        self.assertEqual(Project.objects.get().revision, project['revision'])

    def test_history_delete_requires_confirmation_and_is_idempotent(self):
        project = self.save(self.create(), 'Nuevo').json()['project']
        payload = {'operationId': str(uuid.uuid4()), 'revision': 2, 'confirmation': 'incorrecto'}
        url = self.url(project, 'history/1')
        self.assertEqual(self.client.delete(url, payload, content_type='application/json').status_code, 400)
        payload['confirmation'] = '1'
        ProjectRevision.objects.update(pinned=True)
        self.assertEqual(self.client.delete(url, payload, content_type='application/json').status_code, 400)
        ProjectRevision.objects.update(pinned=False)
        first = self.client.delete(url, payload, content_type='application/json')
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(self.client.delete(url, payload, content_type='application/json').json(), first.json())
        self.assertFalse(ProjectRevision.objects.exists())
        self.assertEqual(Project.objects.get().title, 'Nuevo')

    def test_history_is_private_and_restoration_obeys_conflicts_and_trash(self):
        project = self.save(self.create(), 'Nuevo').json()['project']
        for actor in [self.other, self.admin, self.teacher]:
            client = Client(HTTP_X_CAPI_ACCOUNT=str(actor.pk)); client.force_login(actor)
            for path in ['history', 'history/1']:
                self.assertEqual(client.get(self.url(project, path)).status_code, 404)
            self.assertEqual(client.post(self.url(project, 'history/1/restore'), {}, content_type='application/json').status_code, 404)
            self.assertEqual(client.delete(self.url(project, 'history/1'), {}, content_type='application/json').status_code, 404)
        stale = {'operationId': str(uuid.uuid4()), 'revision': 1}
        self.assertEqual(self.client.post(self.url(project, 'history/1/restore'), stale, content_type='application/json').status_code, 409)
        project = self.action(project, 'trash').json()['project']
        self.assertEqual(self.action(project, 'history/1/restore').status_code, 400)
        self.assertEqual(self.client.get(self.url(project, 'history/1')).status_code, 200)

    def test_purge_after_thirty_days_removes_exact_history_and_blocks_old_creation(self):
        original = self.payload(); project = self.create(original)
        project = self.save(project, 'Para papelera').json()['project']
        self.create()  # Otro proyecto del mismo alumno debe permanecer.
        project = self.action(project, 'trash').json()['project']
        payload = {'operationId': str(uuid.uuid4()), 'revision': project['revision'], 'confirmation': project['title']}
        url = self.url(project, 'purge')
        self.assertEqual(self.client.post(url, payload, content_type='application/json').status_code, 400)
        Project.objects.filter(pk=project['id']).update(trashed_at=timezone.now() - timedelta(days=31))
        self.assertEqual(self.client.post(url, {**payload, 'revision': 1}, content_type='application/json').status_code, 409)
        self.assertEqual(self.client.post(url, {**payload, 'confirmation': 'otro'}, content_type='application/json').status_code, 400)
        for _ in range(2):
            response = self.client.post(url, payload, content_type='application/json')
            self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(Project.objects.count(), 1)
        self.assertFalse(ProjectRevision.objects.exists())
        self.assertTrue(ProjectDeletion.objects.filter(pk=project['id']).exists())
        self.assertEqual(self.client.post(self.root, original, content_type='application/json').status_code, 410)
        self.assertEqual(self.client.put(self.url(project), {}, content_type='application/json').status_code, 404)
        self.assertEqual(ProjectEvent.objects.filter(action='purged').count(), 1)
