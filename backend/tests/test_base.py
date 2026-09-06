import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.contrib.sessions.backends.db import SessionStore
from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError, connection
from django.test import SimpleTestCase, TestCase

from config.settings import read_secret


class HealthTests(SimpleTestCase):
    def test_live_does_not_need_database(self):
        with patch("config.views.connection.cursor", side_effect=AssertionError):
            response = self.client.get("/api/health/live/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertNotIn("sessionid", response.cookies)

    def test_ready_failure_is_generic(self):
        with patch("config.views.connection.cursor", side_effect=OperationalError("private-detail")):
            response = self.client.get("/api/health/ready/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})
        self.assertNotContains(response, "private-detail", status_code=503)

    def test_safe_methods_and_no_account_routes(self):
        self.assertEqual(self.client.head("/api/health/live/").status_code, 200)
        self.assertEqual(self.client.post("/api/health/live/").status_code, 405)
        self.assertEqual(self.client.get("/api/users/").status_code, 404)
        self.assertEqual(self.client.get("/admin/").status_code, 404)

    def test_unknown_host_is_rejected(self):
        self.assertEqual(self.client.get("/api/health/live/", HTTP_HOST="unknown.invalid").status_code, 400)

    def test_secret_must_exist_and_be_long(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                read_secret("MISSING_FILE")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "secret"
            path.write_text("short", encoding="utf-8")
            with patch.dict(os.environ, {"TEST_SECRET_FILE": str(path)}):
                with self.assertRaises(ImproperlyConfigured):
                    read_secret("TEST_SECRET_FILE")
                path.write_text("a" * 128, encoding="utf-8")
                self.assertEqual(read_secret("TEST_SECRET_FILE"), "a" * 128)


class DatabaseTests(TestCase):
    def test_real_postgresql_readiness(self):
        self.assertEqual(connection.vendor, "postgresql")
        response = self.client.get("/api/health/ready/")
        self.assertEqual(response.status_code, 200)

    def test_runtime_role_is_not_administrator(self):
        with connection.cursor() as cursor:
            cursor.execute("SELECT rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user")
            self.assertEqual(cursor.fetchone(), (False, False, False))

    def test_session_roundtrip_without_account_model(self):
        session = SessionStore()
        session["infrastructure_test"] = True
        session.save()
        self.assertIs(SessionStore(session_key=session.session_key)["infrastructure_test"], True)
        session.delete()
        self.assertEqual(SessionStore(session_key=session.session_key).load(), {})
