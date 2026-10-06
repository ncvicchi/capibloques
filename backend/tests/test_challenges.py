import copy
import json
import uuid
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.db import transaction
from django.test import TestCase, override_settings
from accounts.models import User
from accounts.deletion import summary
from courses.models import Course, Membership
from courses.challenges import validate_challenge

FIXTURES = json.loads((Path(__file__).parent / 'fixtures/challenges.json').read_text())


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ChallengeTests(TestCase):
    def setUp(self):
        if settings.DATABASES['default']['ENGINE'].endswith('sqlite3'):
            stack = ExitStack()
            for module in ('accounts.models', 'projects.views', 'accounts.management_api', 'accounts.deletion', 'courses.views'):
                stack.enter_context(patch(module + '.access_lock', transaction.atomic))
            self.addCleanup(stack.close)
        def user(alias, **roles):
            return User.objects.create_user(alias, display_name=alias, password='synthetic-fixture-only', must_change_password=False, **roles)
        self.teacher = user('docente', is_teacher=True, is_student=False)
        self.student = user('alumno')
        self.other = user('otro')
        self.admin = user('admin', is_student=False, is_administrator=True)
        self.course = Course.objects.create(name='Curso ficticio')
        Membership.objects.create(course=self.course, user=self.teacher, role='docente')
        Membership.objects.create(course=self.course, user=self.student, role='alumno')
        self.challenge = copy.deepcopy(FIXTURES[0])
        self.challenge['id'] = str(uuid.uuid4())
        self.url = f'/api/challenges/courses/{self.course.pk}/'
        self.login(self.teacher)

    def login(self, user):
        self.client.force_login(user)
        self.client.defaults['HTTP_X_CAPI_ACCOUNT'] = str(user.pk)

    def edit(self, action, version=None, challenge=None):
        self.course.refresh_from_db()
        return self.client.post(self.url, {'version': version or str(self.course.version), 'action': action, 'challenge': challenge or self.challenge}, content_type='application/json')

    def published(self):
        for action in ('save', 'publish', 'assign'):
            response = self.edit(action)
            self.assertEqual(response.status_code, 200, response.content)

    def test_fixtures_validate(self):
        for challenge in FIXTURES:
            validate_challenge(challenge)

    def test_publish_is_immutable_and_assignment_explicit(self):
        self.assertEqual(self.edit('assign').status_code, 400)
        self.published()
        self.assertEqual(self.edit('publish').status_code, 400)
        c = copy.deepcopy(self.challenge)
        c['title'] = 'No pisar la versión publicada'
        self.assertEqual(self.edit('save', challenge=c).status_code, 200)
        self.course.refresh_from_db()
        self.assertEqual(self.course.challenge_library[c['id']]['versions']['1']['title'], self.challenge['title'])

    def test_membership_role_archive_and_account_isolation(self):
        self.published()
        self.login(self.admin)
        self.assertEqual(self.edit('save').status_code, 404)
        self.assertEqual(self.client.get('/api/challenges/').json()['courses'], [])
        self.login(self.student)
        catalog = self.client.get('/api/challenges/').json()
        self.assertNotIn('draft', catalog['courses'][0]['items'][0])
        self.assertEqual(self.edit('save').status_code, 404)
        self.assertEqual(self.client.get(self.url+'progress/').status_code, 404)
        Membership.objects.filter(course=self.course, user=self.student).delete()
        self.assertEqual(self.client.get('/api/challenges/').json()['courses'], [])
        self.login(self.teacher)
        self.course.is_archived = True
        self.course.save()
        self.assertEqual(self.edit('save').status_code, 404)

    def test_optimistic_save_preserves_draft(self):
        stale = str(self.course.version)
        self.assertEqual(self.edit('save').status_code, 200)
        self.assertEqual(self.edit('save', version=stale).status_code, 409)

    def test_progress_replay_and_teacher_overview_are_scoped(self):
        self.published()
        self.login(self.student)
        body = {'id': self.challenge['id'], 'version': 1, 'courseId': str(self.course.pk), 'operation': str(uuid.uuid4()), 'status': 'passed', 'hints': 2, 'projectId': None}
        for _ in range(2):
            response = self.client.post('/api/challenges/progress/', body, content_type='application/json')
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()['progress']['attempts'], 1)
        body['hints'] = 3
        self.assertEqual(self.client.post('/api/challenges/progress/', body, content_type='application/json').status_code, 400)
        self.login(self.teacher)
        overview = self.client.get(self.url+'progress/')
        self.assertEqual(len(overview.json()['students']), 1)
        self.assertNotIn('operations', json.dumps(overview.json()))
        self.login(self.other)
        self.assertEqual(self.client.get(self.url+'progress/').status_code, 404)
        self.assertEqual(self.client.get('/api/challenges/').json()['progress'], {})

    def test_progress_invalidates_deletion_receipt_and_requires_backup(self):
        self.other.is_active = False
        self.other.save()
        first = summary(self.other)
        self.other.challenge_progress = {'catalog:capi-reto-1:1': {'status': 'passed'}}
        self.other.save(update_fields=['challenge_progress'])
        current = summary(self.other)
        self.assertNotEqual(first['version'], current['version'])
        self.assertEqual(current['challengeProgressCount'], 1)
        self.login(self.admin)
        response = self.client.delete(f'/api/management/users/{self.other.pk}/deletion/', {'version': current['version'], 'confirmationAlias': self.other.username, 'understandsLocalDrafts': True, 'understandsPermanent': True, 'backupReceipt': ''}, content_type='application/json')
        self.assertEqual(response.status_code, 409)
        self.assertTrue(User.objects.filter(pk=self.other.pk).exists())

    def test_upload_limit_before_parser(self):
        response = self.client.post(self.url, 'x'*260001, content_type='application/json')
        self.assertEqual(response.status_code, 413)

    def test_reserved_cases_never_reach_student(self):
        private = copy.deepcopy(self.challenge['variants'][0])
        private.update({'label': 'Sólo docente', 'seed': 987654, 'reserved': True})
        self.challenge['variants'].append(private)
        self.published()
        self.login(self.student)
        item = self.client.get('/api/challenges/').json()['courses'][0]['items'][0]
        self.assertEqual(item['reservedCaseCount'], 1)
        self.assertEqual(len(item['challenge']['variants']), 1)
        self.assertNotIn('Sólo docente', json.dumps(item))
        self.login(self.teacher)
        item = self.client.get('/api/challenges/').json()['courses'][0]['items'][0]
        self.assertEqual(len(item['versions']['1']['variants']), 2)

    def test_invalid_boolean_input_and_duplicate_json(self):
        c = copy.deepcopy(FIXTURES[1])
        c['variants'][0]['inputs'][0]['values'] = [0]
        with self.assertRaises(Exception):
            validate_challenge(c)
        response = self.client.post(self.url, '{"version":"v","version":"w"}', content_type='application/json')
        self.assertEqual(response.status_code, 400)
