import json
import uuid
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError
from django.test import Client, TestCase, override_settings

from accounts.management_api import record
from accounts.models import User
from courses.models import Course, CourseEvent, Membership
from courses.views import managed_record
from .test_accounts import FAST_HASHERS, PASSWORD


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class CourseTests(TestCase):
    def setUp(self):
        self.admin = self.user("admin", is_administrator=True, is_student=False)
        self.teacher_a = self.user("profea", is_teacher=True, is_student=False)
        self.teacher_b = self.user("profeb", is_teacher=True, is_student=False)
        self.student = self.user("luna")
        self.other = self.user("nube")
        self.client.force_login(self.admin)
        self.root = "/api/management/courses/"
        self.a = self.create("Robótica A", [(self.teacher_a, "docente"), (self.student, "alumno")])
        self.b = self.create("Robótica B", [(self.teacher_b, "docente"), (self.student, "alumno"), (self.other, "alumno")])

    def user(self, alias, **fields):
        return User.objects.create_user(alias, password=PASSWORD, display_name=alias, must_change_password=False, **fields)

    def browser(self, user):
        browser = Client()
        browser.force_login(user)
        return browser

    def create(self, name, members=()):
        response = self.client.post(self.root, {"name": name, "description": "Taller", "isArchived": False,
                                              "members": [{"id": str(user.pk), "role": role} for user, role in members]}, content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return Course.objects.get(pk=response.json()["course"]["id"])

    def url(self, course=None, management=True):
        return f"{self.root if management else '/api/courses/'}{(course or self.a).pk}/"

    def data(self, course=None, **changes):
        course = course or self.a
        course.refresh_from_db()
        data = managed_record(course)
        return {"name": data["name"], "description": data["description"], "isArchived": data["isArchived"], "version": data["version"],
                "members": [{"id": member["id"], "role": member["role"]} for member in data["members"]], **changes}

    def update(self, course=None, **changes):
        return self.client.patch(self.url(course), self.data(course, **changes), content_type="application/json")

    def test_admin_endpoints_cannot_be_called_by_teacher_student_or_anonymous(self):
        for user, status in [(None, 401), (self.teacher_a, 403), (self.student, 403)]:
            browser = self.browser(user) if user else Client()
            for url, method in [(self.root, "get"), (self.root, "post"), (self.url(), "get"), (self.url(), "patch")]:
                response = getattr(browser, method)(url, {}, content_type="application/json")
                self.assertEqual(response.status_code, status)
                self.assertNotIn("Robótica", response.content.decode())
        self.assertEqual(Client().get("/api/courses/").status_code, 401)

    def test_teachers_only_see_assigned_courses_and_rosters(self):
        for teacher, mine, other in [(self.teacher_a, self.a, self.b), (self.teacher_b, self.b, self.a)]:
            browser = self.browser(teacher)
            response = browser.get("/api/courses/")
            self.assertIn("no-store", response["Cache-Control"])
            self.assertEqual([item["id"] for item in response.json()["courses"]], [str(mine.pk)])
            detail = browser.get(self.url(mine, False)).json()["course"]
            self.assertEqual(detail["myRole"], "docente")
            self.assertIn(str(self.student.pk), [item["id"] for item in detail["members"]])
            self.assertNotIn("version", detail)
            forbidden = browser.get(self.url(other, False))
            unknown = browser.get(f"/api/courses/{uuid.uuid4()}/")
            self.assertEqual(forbidden.status_code, 404)
            self.assertEqual(forbidden.json(), unknown.json())
        self.assertNotIn(str(self.other.pk), self.browser(self.teacher_a).get(self.url(management=False)).content.decode())

    def test_student_in_two_courses_does_not_receive_other_identities_or_counts(self):
        browser = self.browser(self.student)
        self.assertEqual(len(browser.get("/api/courses/").json()["courses"]), 2)
        for course in [self.a, self.b]:
            response = browser.get(self.url(course, False))
            self.assertEqual(set(response.json()["course"]), {"id", "name", "description", "isArchived", "myRole"})
            self.assertNotIn(str(self.other.pk), response.content.decode())
            self.assertNotIn(self.teacher_a.username, response.content.decode())

    def test_admin_not_automatically_teacher_and_dual_role_still_requires_assignment(self):
        self.assertEqual(self.client.get("/api/courses/").json()["courses"], [])
        self.assertEqual(self.client.get(self.url(management=False)).status_code, 404)
        self.admin.is_teacher = True
        self.admin.save(update_fields=["is_teacher"])
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(self.url(management=False)).status_code, 404)
        members = self.data()["members"] + [{"id": str(self.admin.pk), "role": "docente"}]
        self.assertEqual(self.update(members=members).status_code, 200)
        self.assertEqual(self.client.get(self.url(management=False)).status_code, 200)

    def test_remove_membership_revokes_next_request_without_logout(self):
        teacher = self.browser(self.teacher_a)
        self.assertEqual(teacher.get(self.url(management=False)).status_code, 200)
        self.assertEqual(self.update(members=[{"id": str(self.student.pk), "role": "alumno"}]).status_code, 200)
        self.assertEqual(teacher.get(self.url(management=False)).status_code, 404)
        self.assertEqual(teacher.get("/api/courses/").json()["courses"], [])
        self.assertIsNotNone(teacher.get("/api/auth/session/").json()["user"])

    def test_archive_preserves_authorized_read_blocks_additions_allows_removal_and_reactivation(self):
        self.assertEqual(self.update(isArchived=True).status_code, 200)
        teacher = self.browser(self.teacher_a)
        self.assertEqual(teacher.get("/api/courses/").json()["courses"], [])
        self.assertEqual(len(teacher.get("/api/courses/?status=archived").json()["courses"]), 1)
        self.assertEqual(teacher.get(self.url(management=False)).status_code, 200)
        additions = self.data()["members"] + [{"id": str(self.other.pk), "role": "alumno"}]
        self.assertEqual(self.update(members=additions).status_code, 400)
        self.assertEqual(self.update(isArchived=False, members=additions).status_code, 400)
        self.assertEqual(self.update(members=[]).status_code, 200)
        self.assertEqual(teacher.get(self.url(management=False)).status_code, 404)
        self.assertEqual(self.update(isArchived=False).status_code, 200)
        self.assertEqual(self.update(members=additions).status_code, 200)

    def test_atomic_version_conflict_does_not_overwrite_metadata_or_memberships(self):
        stale = self.data()
        self.assertEqual(self.update(description="Nuevo", members=[]).status_code, 200)
        response = self.client.patch(self.url(), stale, content_type="application/json")
        self.assertEqual(response.status_code, 409)
        self.a.refresh_from_db()
        self.assertEqual(self.a.description, "Nuevo")
        self.assertFalse(self.a.memberships.exists())
        self.assertEqual(CourseEvent.objects.count(), 3)

    def test_member_account_changes_invalidate_version_without_password_coupling(self):
        stale = self.data()
        self.student.display_name = "Luna actualizada"
        self.student.save(update_fields=["display_name"])
        self.assertEqual(self.client.patch(self.url(), stale, content_type="application/json").status_code, 409)
        fresh = self.data()
        self.student.set_password("test-only-other-password")
        self.student.save(update_fields=["password"])
        self.assertEqual(self.client.patch(self.url(), fresh, content_type="application/json").status_code, 200)

    def test_deactivation_hides_roster_member_and_revokes_access_but_retains_assignment(self):
        browser = self.browser(self.student)
        self.student.is_active = False
        self.student.save(update_fields=["is_active"])
        self.assertEqual(browser.get(self.url(management=False)).status_code, 401)
        members = self.browser(self.teacher_a).get(self.url(management=False)).json()["course"]["members"]
        self.assertNotIn(str(self.student.pk), [item["id"] for item in members])
        self.assertFalse(next(item for item in self.client.get(self.url()).json()["course"]["members"] if item["id"] == str(self.student.pk))["isActive"])
        self.assertEqual(self.update(description="Retener inactivo").status_code, 200)
        self.student.is_active = True
        self.student.save(update_fields=["is_active"])
        self.assertEqual(self.browser(self.student).get(self.url(management=False)).status_code, 200)

    def test_role_change_and_account_deletion_require_explicit_membership_removal(self):
        account_url = f"/api/management/users/{self.teacher_a.pk}/"
        profile = {"alias": self.teacher_a.username, "displayName": self.teacher_a.display_name, "roles": ["alumno"], "isActive": True, "version": record(self.teacher_a)["version"]}
        self.assertEqual(self.client.patch(account_url, profile, content_type="application/json").status_code, 400)
        delete = {"version": profile["version"], "confirmationAlias": self.teacher_a.username, "understandsLocalDrafts": True}
        response = self.client.delete(account_url, delete, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("membresías", response.json()["error"])
        self.assertEqual(self.a.memberships.count(), 2)
        self.assertEqual(self.update(members=[]).status_code, 200)
        self.assertEqual(self.client.delete(account_url, delete, content_type="application/json").status_code, 200)
        self.assertTrue(Course.objects.filter(pk=self.a.pk).exists())

    def test_orm_deletion_protected_and_archived_memberships_still_protect_roles(self):
        self.update(isArchived=True)
        with self.assertRaises(ProtectedError):
            with transaction.atomic():
                self.a.delete()
        with self.assertRaises(ValidationError):
            self.student.delete()
        self.teacher_a.is_teacher, self.teacher_a.is_student = False, True
        with self.assertRaises(ValidationError):
            self.teacher_a.save()

    def test_invalid_roles_unknown_inactive_duplicate_members_and_limits_rejected_atomically(self):
        inactive = self.user("inactivo", is_active=False)
        for members in [
            [{"id": str(self.admin.pk), "role": "docente"}],
            [{"id": str(self.student.pk), "role": "docente"}],
            [{"id": str(inactive.pk), "role": "alumno"}],
            [{"id": str(uuid.uuid4()), "role": "alumno"}],
            [{"id": str(self.student.pk), "role": "alumno"}] * 2,
            [{"id": str(self.student.pk), "role": "administrador"}],
            [{"id": {}, "role": "alumno"}], [None], "bad", [{}] * 201,
        ]:
            self.assertEqual(self.update(name="No guardar", members=members).status_code, 400)
            self.a.refresh_from_db()
            self.assertEqual(self.a.name, "Robótica A")
            self.assertEqual(self.a.memberships.count(), 2)
        self.assertEqual(CourseEvent.objects.count(), 2)

    def test_fields_and_request_boundaries(self):
        for changes in [{"name": " "}, {"name": "a" * 101}, {"name": "uno\ndos"}, {"description": None}, {"isArchived": "true"}, {"owner": str(self.student.pk)}, {"version": "bad"}]:
            self.assertEqual(self.update(**changes).status_code, 400)
        self.assertEqual(self.client.patch(self.url(), "x" * 17000, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.delete(self.url()).status_code, 405)
        self.assertEqual(self.client.patch(self.url(management=False), self.data(), content_type="application/json").status_code, 405)

    def test_names_unique_filtering_pagination_and_noop(self):
        self.assertEqual(self.update(name="robótica b").status_code, 409)
        token = self.data()["version"]
        self.assertEqual(self.update().json()["course"]["version"], token)
        self.assertEqual(CourseEvent.objects.count(), 2)
        for i in range(21):
            Course.objects.create(name=f"Grupo {i:02}")
        result = self.client.get(self.root, {"q": "Grupo", "page": 2}).json()
        self.assertEqual((result["count"], len(result["courses"]), result["page"]), (21, 1, 2))
        self.assertEqual(self.client.get(self.root, {"page": -1}).status_code, 400)
        self.assertEqual(self.client.get(self.root, {"status": "deleted"}).status_code, 400)

    def test_csrf_and_forced_password_change(self):
        browser = Client(enforce_csrf_checks=True)
        browser.force_login(self.admin)
        token = browser.get(self.root).json()["csrfToken"]
        self.assertEqual(browser.patch(self.url(), self.data(), content_type="application/json").status_code, 403)
        self.assertEqual(browser.patch(self.url(), self.data(), content_type="application/json", HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.admin.must_change_password = True
        self.admin.save(update_fields=["must_change_password"])
        browser.force_login(self.admin)
        self.assertEqual(browser.get(self.root).status_code, 403)

    def test_permissions_refreshed_inside_lock_before_read_and_write(self):
        from accounts.models import access_lock
        from contextlib import contextmanager

        @contextmanager
        def revoke():
            with access_lock():
                self.admin.must_change_password = True
                self.admin.save(update_fields=["must_change_password"])
                yield

        with patch("courses.views.access_lock", revoke):
            self.assertEqual(self.client.patch(self.url(), self.data(description="No guardar"), content_type="application/json").status_code, 401)
        self.a.refresh_from_db()
        self.assertEqual(self.a.description, "Taller")

    def test_constraints_and_audit_survive_actor_deletion(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(course=self.a, user=self.student, role="alumno")
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Membership.objects.create(course=self.a, user=self.other, role="admin")
        actor_id = self.admin.pk
        self.user("backup", is_administrator=True, is_student=False)
        self.admin.delete()
        event = CourseEvent.objects.order_by("id").first()
        self.assertIsNone(event.actor_id)
        self.assertEqual(event.actor_id_snapshot, actor_id)
        self.assertNotIn(PASSWORD, json.dumps(list(CourseEvent.objects.values()), default=str))
        self.assertEqual(Course.objects.count(), 2)
