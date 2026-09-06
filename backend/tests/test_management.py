import json
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from accounts.models import ManagementEvent, User
from accounts.management_api import locked_actor, record
from .test_accounts import FAST_HASHERS, PASSWORD, NEW_PASSWORD


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class ManagementTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password=PASSWORD, display_name="Admin", is_administrator=True, is_student=False, must_change_password=False)
        self.student = User.objects.create_user("luna", password=PASSWORD, display_name="Luna", must_change_password=False)
        self.teacher = User.objects.create_user("profe", password=PASSWORD, display_name="Profe", is_teacher=True, is_student=False, must_change_password=False)
        self.client.force_login(self.admin)
        self.root = "/api/management/users/"

    def url(self, user=None):
        return f"{self.root}{(user or self.student).pk}/"

    def profile(self, user=None, **changes):
        user = user or self.student
        return {"alias": user.username, "displayName": user.display_name, "roles": user.roles, "isActive": user.is_active, "version": record(user)["version"], **changes}

    def create(self, **changes):
        return self.client.post(self.root, {"alias": "nueva", "displayName": "Nueva", "roles": ["alumno"], "isActive": True, "temporaryPassword": PASSWORD, "confirmation": PASSWORD, **changes}, content_type="application/json")

    def reset(self, user=None, **changes):
        user = user or self.student
        return self.client.post(self.url(user) + "password/", {"version": record(user)["version"], "temporaryPassword": NEW_PASSWORD, "confirmation": NEW_PASSWORD, **changes}, content_type="application/json")

    def delete(self, user=None, **changes):
        user = user or self.student
        return self.client.delete(self.url(user), {"version": record(user)["version"], "confirmationAlias": user.username, "understandsLocalDrafts": True, **changes}, content_type="application/json")

    def test_all_endpoints_require_admin_including_detail_and_writes(self):
        for user, status in [(None, 401), (self.student, 403), (self.teacher, 403)]:
            client = Client()
            if user:
                client.force_login(user)
            for url, method in [(self.root, "get"), (self.root, "post"), (self.url(), "get"), (self.url(), "patch"), (self.url(), "delete"), (self.url() + "password/", "post")]:
                response = getattr(client, method)(url, {}, content_type="application/json")
                self.assertEqual(response.status_code, status)
                self.assertNotIn("Luna", response.content.decode())
        self.assertEqual(User.objects.count(), 3)

    def test_temporary_administrator_cannot_manage(self):
        self.admin.must_change_password = True
        self.admin.save(update_fields=["must_change_password"])
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(self.root).status_code, 403)
        self.assertEqual(self.create().status_code, 403)

    def test_list_search_filters_pagination_and_no_sensitive_fields(self):
        response = self.client.get(self.root, {"q": "LUN", "role": "alumno"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual([user["alias"] for user in response.json()["users"]], ["luna"])
        self.assertNotIn(PASSWORD, response.content.decode())
        self.assertNotIn("password", response.json()["users"][0])
        for number in range(21):
            User.objects.create_user(f"alumno{number}", password=PASSWORD, display_name="Prueba", is_active=False)
        first = self.client.get(self.root, {"active": "false", "page": "1"}).json()
        second = self.client.get(self.root, {"active": "false", "page": "2"}).json()
        self.assertEqual((first["count"], len(first["users"]), len(second["users"])), (21, 20, 1))
        self.assertEqual(self.client.get(self.root, {"page": "-1"}).status_code, 400)
        self.assertEqual(self.client.get(self.root, {"role": "superuser"}).status_code, 400)

    def test_create_normalizes_alias_sets_temporary_password_and_audits_without_secret(self):
        response = self.create(alias=" NUEVA ", roles=["administrador", "docente"])
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(username="nueva")
        self.assertTrue(user.check_password(PASSWORD))
        self.assertTrue(user.must_change_password)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)
        event = ManagementEvent.objects.get()
        self.assertEqual(event.actor_id_snapshot, self.admin.pk)
        self.assertEqual(event.target_id_snapshot, user.pk)
        self.assertNotIn(PASSWORD, json.dumps(list(ManagementEvent.objects.values()), default=str))
        self.assertNotIn(PASSWORD, response.content.decode())
        self.assertEqual(self.create(alias="NUEVA").status_code, 409)

    def test_create_rejects_malformed_roles_privilege_injection_password_and_types(self):
        for changes in [{"roles": ["administrador", "alumno"]}, {"roles": ["alumno", "alumno"]}, {"roles": "alumno"}, {"roles": [{}]}, {"isActive": "true"}, {"displayName": " "}, {"is_superuser": True}, {"temporaryPassword": "1234567890", "confirmation": "1234567890"}, {"confirmation": "no coincide"}]:
            self.assertEqual(self.create(**changes).status_code, 400)
        self.assertEqual(User.objects.count(), 3)
        self.assertFalse(ManagementEvent.objects.exists())

    def test_patch_preserves_uuid_revokes_access_and_stale_version_conflicts(self):
        student_browser = Client(); student_browser.force_login(self.student)
        original = self.profile(alias="luna-nueva", roles=["docente"])
        response = self.client.patch(self.url(), original, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["id"], str(self.student.pk))
        self.assertIsNone(student_browser.get("/api/auth/session/").json()["user"])
        self.assertEqual(self.client.patch(self.url(), original, content_type="application/json").status_code, 409)
        self.student.refresh_from_db()
        self.assertEqual(self.student.username, "luna-nueva")
        self.assertTrue(self.student.is_teacher)

    def test_display_name_alone_changes_version_without_revoking_session(self):
        old = record(self.student)
        student_browser = Client(); student_browser.force_login(self.student)
        response = self.client.patch(self.url(), self.profile(displayName="Luna editada"), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.json()["user"]["version"], old["version"])
        self.assertIsNotNone(student_browser.get("/api/auth/session/").json()["user"])

    def test_deactivation_and_reactivation_keep_identity_but_not_old_sessions(self):
        student_browser = Client(); student_browser.force_login(self.student)
        self.assertEqual(self.client.patch(self.url(), self.profile(isActive=False), content_type="application/json").status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.client.patch(self.url(), self.profile(isActive=True), content_type="application/json").status_code, 200)
        self.assertIsNone(student_browser.get("/api/auth/session/").json()["user"])

    def test_password_reset_revokes_sessions_without_changing_roles_or_activation(self):
        student_browser = Client(); student_browser.force_login(self.student)
        self.assertEqual(self.reset().status_code, 200)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password(NEW_PASSWORD))
        self.assertTrue(self.student.must_change_password)
        self.assertTrue(self.student.is_active)
        self.assertEqual(self.student.roles, ["alumno"])
        self.assertIsNone(student_browser.get("/api/auth/session/").json()["user"])
        self.student.is_active = False; self.student.save(update_fields=["is_active"])
        self.assertEqual(self.reset().status_code, 200)
        self.student.refresh_from_db(); self.assertFalse(self.student.is_active)

    def test_last_admin_cannot_be_deleted_demoted_or_deactivated(self):
        self.assertEqual(self.delete(self.admin).status_code, 400)
        for changes in [{"roles": ["docente"]}, {"isActive": False}]:
            self.assertEqual(self.client.patch(self.url(self.admin), self.profile(self.admin, **changes), content_type="application/json").status_code, 400)
        self.assertFalse(ManagementEvent.objects.exists())
        self.assertEqual(self.client.get(self.root).status_code, 200)

    def test_delete_needs_confirmation_and_reusing_alias_does_not_transfer_uuid(self):
        old_id = self.student.pk
        self.assertEqual(self.delete(confirmationAlias="otra").status_code, 400)
        self.assertEqual(self.delete(understandsLocalDrafts=False).status_code, 400)
        self.assertEqual(self.delete().status_code, 200)
        self.assertFalse(User.objects.filter(pk=old_id).exists())
        self.assertEqual(ManagementEvent.objects.get().target_id_snapshot, old_id)
        new = self.create(alias="luna").json()["user"]
        self.assertNotEqual(new["id"], str(old_id))

    def test_self_role_change_and_self_delete_end_current_session(self):
        User.objects.create_user("otro-admin", password=PASSWORD, display_name="Otro", is_administrator=True, is_student=False, must_change_password=False)
        response = self.client.patch(self.url(self.admin), self.profile(self.admin, roles=["docente"]), content_type="application/json")
        self.assertTrue(response.json()["sessionEnded"])
        self.assertEqual(self.client.get(self.root).status_code, 401)
        self.client.force_login(User.objects.get(username="otro-admin"))
        self.admin.refresh_from_db()
        self.assertEqual(self.delete(self.admin).status_code, 200)

    def test_actor_revoked_while_waiting_cannot_write(self):
        original = locked_actor
        def revoke(request):
            actor = User.objects.get(pk=request.user.pk)
            actor.session_epoch += 1
            actor.save(update_fields=["session_epoch"])
            return original(request)
        with patch("accounts.management_api.locked_actor", side_effect=revoke):
            self.assertEqual(self.create().status_code, 401)
        self.assertFalse(User.objects.filter(username="nueva").exists())

    def test_csrf_and_json_required_and_missing_uuid_not_leaked_to_nonadmin(self):
        browser = Client(enforce_csrf_checks=True); browser.force_login(self.admin)
        for method, url in [("post", self.root), ("patch", self.url()), ("delete", self.url()), ("post", self.url() + "password/")]:
            self.assertEqual(getattr(browser, method)(url, {}, content_type="application/json").status_code, 403)
        self.assertEqual(self.client.post(self.root, "[]", content_type="application/json").status_code, 400)
        self.assertEqual(self.client.get(self.root + "00000000-0000-0000-0000-000000000000/").status_code, 404)
