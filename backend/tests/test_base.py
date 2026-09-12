import os
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.core.exceptions import ImproperlyConfigured
from django.db import OperationalError, connection
from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from config.proxy import TrustedProxyHeadersMiddleware, resolve_client_ip
from config.settings import (read_allowed_hosts, read_bool, read_https_origins, read_proxy_ips, read_secret,
                             validate_public_https)


class HealthTests(SimpleTestCase):
    def test_live_does_not_need_database(self):
        with patch("config.views.connection") as database:
            database.cursor.side_effect = AssertionError
            response = self.client.get("/api/health/live/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertNotIn("sessionid", response.cookies)

    def test_ready_failure_is_generic(self):
        with patch("config.views.connection") as database:
            database.cursor.side_effect = OperationalError("private-detail")
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

    def test_malformed_hosts_are_rejected(self):
        for host in ("bad host", "https://capibloques.dev.nvicchi.com", "[invalid"):
            with self.subTest(host=host):
                self.assertEqual(self.client.get("/api/health/live/", HTTP_HOST=host).status_code, 400)

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


class ExternalAccessSettingsTests(SimpleTestCase):
    def test_proxy_and_https_middleware_order_is_security_preserving(self):
        middleware = settings.MIDDLEWARE
        self.assertLess(middleware.index("config.proxy.TrustedProxyHeadersMiddleware"),
                        middleware.index("django.middleware.security.SecurityMiddleware"))
        self.assertLess(middleware.index("django.middleware.security.SecurityMiddleware"),
                        middleware.index("config.proxy.RequirePublicHttpsMiddleware"))
        self.assertLess(middleware.index("config.proxy.RequirePublicHttpsMiddleware"),
                        middleware.index("django.contrib.sessions.middleware.SessionMiddleware"))

    def test_external_values_are_strict_and_secrets_are_not_in_errors(self):
        environment = {
            "TEST_HOSTS": "capibloques.dev.nvicchi.com",
            "TEST_ORIGINS": "https://capibloques.dev.nvicchi.com",
            "TEST_SECURE": "true",
            "TEST_PROXIES": "192.168.1.30,2001:db8::30",
        }
        with patch.dict(os.environ, environment):
            self.assertEqual(read_allowed_hosts("TEST_HOSTS"), ("capibloques.dev.nvicchi.com",))
            self.assertEqual(read_https_origins("TEST_ORIGINS"), ("https://capibloques.dev.nvicchi.com",))
            self.assertIs(read_bool("TEST_SECURE"), True)
            self.assertEqual(read_proxy_ips("TEST_PROXIES"), frozenset({"192.168.1.30", "2001:db8::30"}))

        invalid_values = {
            "TEST_HOSTS": "*",
            "TEST_ORIGINS": "http://capibloques.dev.nvicchi.com",
            "TEST_SECURE": "sometimes",
            "TEST_PROXIES": "192.168.1.0/24",
        }
        readers = (read_allowed_hosts, read_https_origins, read_bool, read_proxy_ips)
        for (variable, value), reader in zip(invalid_values.items(), readers):
            with self.subTest(variable=variable), patch.dict(os.environ, {variable: value}):
                with self.assertRaises(ImproperlyConfigured) as error:
                    reader(variable)
                self.assertNotIn(value, str(error.exception))

    def test_duplicate_or_empty_entries_fail_closed(self):
        for value in ("proxy.local,proxy.local", "proxy.local,,other.local"):
            with self.subTest(value=value), patch.dict(os.environ, {"TEST_HOSTS": value}):
                with self.assertRaises(ImproperlyConfigured):
                    read_allowed_hosts("TEST_HOSTS")

    def test_https_origin_rejects_wildcards_fragments_and_bad_ports(self):
        for value in ("https://*.nvicchi.com", "https://dev.nvicchi.com#fragment", "https://dev.nvicchi.com:bad"):
            with self.subTest(value=value), patch.dict(os.environ, {"TEST_ORIGINS": value}):
                with self.assertRaises(ImproperlyConfigured):
                    read_https_origins("TEST_ORIGINS")

    def test_host_and_origin_reject_ambiguous_case_and_trailing_dot(self):
        invalid = (
            (read_allowed_hosts, "TEST_HOSTS", "CapiBloques.dev.nvicchi.com"),
            (read_allowed_hosts, "TEST_HOSTS", "capibloques.dev.nvicchi.com."),
            (read_https_origins, "TEST_ORIGINS", "https://CapiBloques.dev.nvicchi.com"),
            (read_https_origins, "TEST_ORIGINS", "https://capibloques.dev.nvicchi.com."),
        )
        for reader, variable, value in invalid:
            with self.subTest(value=value), patch.dict(os.environ, {variable: value}):
                with self.assertRaises(ImproperlyConfigured):
                    reader(variable)

    def test_secure_startup_requires_exact_external_https_host_set(self):
        proxies = frozenset({"192.168.1.30"})
        validate_public_https({"dev.nvicchi.com"}, {"dev.nvicchi.com"}, proxies, True)
        for external, https in (
            ({"dev.nvicchi.com", "extra.nvicchi.com"}, {"dev.nvicchi.com"}),
            ({"dev.nvicchi.com"}, {"dev.nvicchi.com", "extra.nvicchi.com"}),
        ):
            with self.subTest(external=external, https=https):
                with self.assertRaises(ImproperlyConfigured):
                    validate_public_https(external, https, proxies, True)


class TrustedProxyTests(SimpleTestCase):
    trusted = frozenset({"10.0.0.2", "10.0.0.3"})

    def run_middleware(self, remote_addr, forwarded_for=None, forwarded_proto=None, internal_proto=None):
        request = RequestFactory().get("/")
        request.META["REMOTE_ADDR"] = remote_addr
        if forwarded_for is not None:
            request.META["HTTP_X_FORWARDED_FOR"] = forwarded_for
        if forwarded_proto is not None:
            request.META["HTTP_X_FORWARDED_PROTO"] = forwarded_proto
        if internal_proto is not None:
            request.META["HTTP_X_CAPIBLOQUES_TRUSTED_PROTO"] = internal_proto
        observed = {}

        def endpoint(current):
            observed.update(
                client_ip=current.capibloques_client_ip,
                forwarded_headers_present=any(
                    header in current.META for header in ("HTTP_X_FORWARDED_FOR", "HTTP_X_FORWARDED_PROTO")
                ),
                secure=current.is_secure(),
            )
            return JsonResponse({"ok": True})

        with override_settings(CAPIBLOQUES_TRUSTED_PROXY_IPS=self.trusted):
            TrustedProxyHeadersMiddleware(endpoint)(request)
        return observed

    def test_direct_client_cannot_spoof_ip_or_https(self):
        observed = self.run_middleware(
            "198.51.100.8",
            forwarded_for="203.0.113.77",
            forwarded_proto="https",
            internal_proto="https",
        )
        self.assertEqual(observed, {
            "client_ip": "198.51.100.8",
            "forwarded_headers_present": False,
            "secure": False,
        })

    def test_trusted_chain_uses_nearest_untrusted_hop(self):
        observed = self.run_middleware(
            "10.0.0.3",
            forwarded_for="192.0.2.66, 203.0.113.8, 10.0.0.2",
            forwarded_proto="https",
        )
        # 192.0.2.66 es un prefijo falsificado por el cliente. El proxy externo
        # observado (203.0.113.8) es el primer salto no confiable desde la derecha.
        self.assertEqual(observed, {
            "client_ip": "203.0.113.8",
            "forwarded_headers_present": False,
            "secure": True,
        })

    def test_trusted_inner_proxy_accepts_one_client_address(self):
        observed = self.run_middleware(
            "10.0.0.3",
            forwarded_for="203.0.113.9",
            forwarded_proto="https",
        )
        self.assertEqual(observed, {
            "client_ip": "203.0.113.9",
            "forwarded_headers_present": False,
            "secure": True,
        })

    def test_malformed_chain_and_ambiguous_proto_fail_closed(self):
        observed = self.run_middleware(
            "10.0.0.3",
            forwarded_for="203.0.113.8, invalid",
            forwarded_proto="https,http",
        )
        self.assertEqual(observed, {
            "client_ip": "10.0.0.3",
            "forwarded_headers_present": False,
            "secure": False,
        })

    def test_resolution_without_forwarding_keeps_direct_peer(self):
        self.assertEqual(resolve_client_ip("198.51.100.9", "203.0.113.9", self.trusted), "198.51.100.9")
        self.assertEqual(resolve_client_ip("invalid", "203.0.113.9", self.trusted), "unknown")


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
