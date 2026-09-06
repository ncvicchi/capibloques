import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from io import StringIO
from threading import Barrier
from unittest.mock import patch

from django.contrib.auth.hashers import identify_hasher
from django.core.exceptions import ValidationError
from django.core.management import call_command, CommandError
from django.db import IntegrityError, close_old_connections, connection, transaction
from django.http import JsonResponse
from django.test import Client, RequestFactory, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from accounts.models import AccessEvent, LoginBucket, User
from accounts.security import require_account


PASSWORD = "Un bosque de prueba 84!"  # Únicamente fixtures, nunca credenciales de instalación.
NEW_PASSWORD = "Otra frase de prueba 95!"
FAST_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class AccountTests(TestCase):
    def setUp(self):
        self.student = User.objects.create_user("Luna", password=PASSWORD, display_name="Luna", must_change_password=False)

    def post(self, path, data=None, client=None):
        return (client or self.client).post("/api/auth/" + path + "/", data or {}, content_type="application/json")

    def sign_in(self, client=None, alias="LUNA", password=PASSWORD):
        return self.post("login", {"alias": alias, "password": password}, client)

    def state(self, client=None):
        return (client or self.client).get("/api/auth/session/").json()

    def test_own_model_and_unique_normalized_alias(self):
        self.assertEqual(self.student.username, "luna")
        self.assertEqual(self.student.pk.version, 4)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user("LUNA", password=PASSWORD, display_name="Otra")
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('auth_user')")
            self.assertIsNone(cursor.fetchone()[0])

    def test_anonymous_state_discloses_no_users(self):
        response = self.client.get("/api/auth/session/")
        self.assertIsNone(response.json()["user"])
        self.assertEqual(set(response.json()), {"user", "csrfToken"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertTrue(response.cookies["csrftoken"]["httponly"])
        self.assertEqual(self.client.get("/api/users/").status_code, 404)
        self.assertEqual(self.client.get("/admin/").status_code, 404)
        self.assertEqual(self.post("register").status_code, 404)

    def test_login_normalizes_alias_and_exposes_only_own_identity(self):
        response = self.sign_in(alias=" Luna ")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user"]["roles"], ["alumno"])
        self.assertEqual(set(response.json()["user"]), {"id", "alias", "displayName", "roles", "mustChangePassword"})
        self.assertNotIn(PASSWORD, response.content.decode())
        self.assertTrue(response.cookies["sessionid"]["httponly"])
        self.assertEqual(response.cookies["sessionid"]["samesite"], "Lax")

    def test_failure_does_not_distinguish_missing_inactive_or_wrong_password(self):
        wrong = self.sign_in(password="incorrecta")
        missing = self.sign_in(alias="nobody")
        self.student.is_active = False
        self.student.save(update_fields=["is_active"])
        inactive = self.sign_in()
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.json(), missing.json())
        self.assertEqual(wrong.json(), inactive.json())

    def test_invalid_alias_cannot_authenticate_as_another_account(self):
        User.objects.create_user("invalid-alias", password=PASSWORD, display_name="No confundir")
        self.assertEqual(self.sign_in(alias="!").status_code, 401)

    def test_csrf_required_including_login_logout_and_foreign_origin(self):
        browser = Client(enforce_csrf_checks=True)
        self.assertEqual(self.sign_in(browser).status_code, 403)
        token = self.state(browser)["csrfToken"]
        data = {"alias": "luna", "password": PASSWORD}
        self.assertEqual(browser.post("/api/auth/login/", data, content_type="application/json", HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN="https://foreign.invalid").status_code, 403)
        response = browser.post("/api/auth/login/", data, content_type="application/json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(token, response.json()["csrfToken"])
        self.assertEqual(self.post("logout", client=browser).status_code, 403)
        for path in ("login", "logout", "password", "logout-all"):
            self.assertEqual(browser.get("/api/auth/" + path + "/").status_code, 405)

    def test_rate_limit_is_shared_across_sessions_and_recovers(self):
        for _ in range(8):
            self.assertEqual(self.sign_in(Client(), password="incorrecta").status_code, 401)
        blocked = self.sign_in(Client())
        self.assertEqual(blocked.status_code, 429)
        self.assertEqual(blocked["Retry-After"], "300")
        self.assertTrue(all("luna" not in key for key in LoginBucket.objects.values_list("key", flat=True)))
        with patch("accounts.security.timezone.now", return_value=timezone.now() + timedelta(minutes=6)):
            self.assertEqual(self.sign_in().status_code, 200)

    def test_fields_cannot_inject_roles_or_accept_unbounded_inputs(self):
        self.assertEqual(self.post("login", {"alias": "luna", "password": PASSWORD, "is_administrator": True}).status_code, 400)
        self.assertEqual(self.sign_in(password="x" * 257).status_code, 400)
        self.assertEqual(self.client.post("/api/auth/login/", "[1]", content_type="application/json").status_code, 400)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_administrator)

    def test_password_change_preserves_current_session_revokes_others(self):
        second = Client()
        self.sign_in(); self.sign_in(second)
        response = self.post("password", {"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD, "confirmation": NEW_PASSWORD})
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(self.state()["user"])
        self.assertIsNone(self.state(second)["user"])
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password(NEW_PASSWORD))
        self.assertFalse(self.student.must_change_password)

    def test_bad_password_change_preserves_password(self):
        self.sign_in()
        for new, confirmation, old in [(NEW_PASSWORD, "no coincide", PASSWORD), ("1234567890", "1234567890", PASSWORD), (NEW_PASSWORD, NEW_PASSWORD, "incorrecta")]:
            self.assertEqual(self.post("password", {"currentPassword": old, "newPassword": new, "confirmation": confirmation}).status_code, 400)
        self.student.refresh_from_db()
        self.assertTrue(self.student.check_password(PASSWORD))

    def test_deactivate_and_reactivate_does_not_resurrect_session(self):
        self.sign_in()
        self.student.is_active = False; self.student.save(update_fields=["is_active"])
        self.student.is_active = True; self.student.save(update_fields=["is_active"])
        self.assertIsNone(self.state()["user"])

    def test_role_change_revokes_session(self):
        self.sign_in()
        self.student.is_student = False; self.student.is_teacher = True
        self.student.save(update_fields=["is_student", "is_teacher"])
        self.assertIsNone(self.state()["user"])
        self.assertEqual(self.sign_in().json()["user"]["roles"], ["docente"])

    def test_logout_is_current_only_and_logout_all_revokes_other_devices(self):
        second = Client(); self.sign_in(); self.sign_in(second)
        self.post("logout")
        self.assertIsNone(self.state()["user"])
        self.assertIsNotNone(self.state(second)["user"])
        self.sign_in(); self.post("logout-all")
        self.assertIsNone(self.state()["user"])
        self.assertIsNone(self.state(second)["user"])

    def test_required_password_change_and_roles_are_server_checked(self):
        @require_account("administrador")
        def protected(request):
            return JsonResponse({"ok": True})
        request = RequestFactory().get("/")
        request.user = self.student
        self.assertEqual(protected(request).status_code, 403)
        self.student.must_change_password = True
        self.assertEqual(json.loads(protected(request).content)["code"], "password_change_required")
        self.student.must_change_password = False
        self.student.is_student = False
        self.student.is_administrator = True
        self.assertEqual(protected(request).status_code, 200)

    def test_last_active_administrator_cannot_be_disabled_demoted_or_deleted(self):
        admin = User.objects.create_user("admin", password=PASSWORD, display_name="Admin", is_administrator=True, is_student=False)
        admin.is_active = False
        with self.assertRaises(ValidationError): admin.save(update_fields=["is_active"])
        admin.refresh_from_db(); admin.is_administrator = False; admin.is_teacher = True
        with self.assertRaises(ValidationError): admin.save(update_fields=["is_administrator", "is_teacher"])
        admin.refresh_from_db()
        with self.assertRaises(ValidationError): admin.delete()

    def test_bootstrap_is_local_once_no_default_password_or_superuser(self):
        out = StringIO()
        with patch("builtins.input", side_effect=["Administrador", "Administrador"]), patch("accounts.management.commands.bootstrap_admin.getpass", return_value=PASSWORD):
            call_command("bootstrap_admin", stdout=out)
        admin = User.objects.get(username="administrador")
        self.assertTrue(admin.is_administrator)
        self.assertFalse(admin.is_superuser)
        self.assertFalse(admin.must_change_password)
        self.assertNotIn(PASSWORD, out.getvalue())
        with self.assertRaises(CommandError): call_command("bootstrap_admin", stdout=out)

    def test_audit_does_not_store_passwords_or_request_payloads(self):
        self.sign_in(); self.post("logout")
        events = list(AccessEvent.objects.values("action", "user_id"))
        self.assertEqual([event["action"] for event in events], ["login", "logout"])
        self.assertNotIn(PASSWORD, str(events))

    def test_local_recovery_revokes_sessions_without_changing_roles(self):
        self.sign_in()
        with patch("accounts.management.commands.reset_account_password.getpass", return_value=NEW_PASSWORD):
            call_command("reset_account_password", "LUNA", stdout=StringIO())
        self.assertIsNone(self.state()["user"])
        response = self.sign_in(password=NEW_PASSWORD)
        self.assertTrue(response.json()["user"]["mustChangePassword"])
        self.assertEqual(response.json()["user"]["roles"], ["alumno"])


class ProductionHashTests(TestCase):
    def test_real_password_hasher_is_salted_pbkdf2(self):
        first, second = User(), User()
        first.set_password(PASSWORD); second.set_password(PASSWORD)
        self.assertEqual(identify_hasher(first.password).algorithm, "pbkdf2_sha256")
        self.assertNotEqual(first.password, second.password)
        self.assertTrue(first.check_password(PASSWORD))


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class ConcurrentAccessTests(TransactionTestCase):
    def test_two_concurrent_removals_leave_one_admin(self):
        users = [User.objects.create_user(f"admin{n}", password=PASSWORD, display_name="Admin", is_student=False, is_administrator=True) for n in range(2)]
        barrier = Barrier(2)

        def disable(pk):
            close_old_connections()
            try:
                user = User.objects.get(pk=pk)
                barrier.wait(timeout=10)
                user.is_active = False
                try:
                    user.save(update_fields=["is_active"])
                    return "changed"
                except ValidationError:
                    return "protected"
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(disable, [user.pk for user in users]))
        self.assertCountEqual(results, ["changed", "protected"])
        self.assertEqual(User.objects.filter(is_active=True, is_administrator=True).count(), 1)
