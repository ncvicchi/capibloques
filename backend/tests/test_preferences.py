import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import close_old_connections
from django.test import Client, TestCase, TransactionTestCase, override_settings

from accounts.models import AccessEvent, User
from accounts.preferences import AVATARS, BLOCKS, record
from .test_accounts import FAST_HASHERS, PASSWORD

URL = "/api/auth/preferences/"


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class PreferenceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("luna", password=PASSWORD, display_name="Luna", must_change_password=False)
        self.other = User.objects.create_user("sol", password=PASSWORD, display_name="Sol", must_change_password=False, is_student=False, is_teacher=True)
        self.client.force_login(self.user)
        self.headers = {"HTTP_X_CAPI_ACCOUNT": str(self.user.pk)}

    def patch(self, data, client=None, headers=None):
        return (client or self.client).patch(URL, json.dumps(data), content_type="application/json", **(headers or self.headers))

    def test_catalog_private_preferences_and_safe_defaults(self):
        # Bootstrap y recuperación usan full_clean, no sólo User.save().
        self.user.full_clean()
        anonymous = Client().get(URL)
        self.assertEqual(anonymous.status_code, 401)
        response = self.client.get(URL, **self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])
        self.assertEqual(response.json()["preferences"], {"avatarId":"capybara", "favorites":[], "version":1, "configured":False})
        session = self.client.get("/api/auth/session/").json()["user"]
        self.assertEqual(session["avatarId"], "capybara")
        self.assertNotIn("favorites", session)
        self.assertNotIn("capi_start", BLOCKS)
        self.assertGreaterEqual(len(AVATARS), 12)

    def test_patch_persists_across_sessions_without_revoking_or_changing_roles(self):
        session_epoch = self.user.session_epoch
        response = self.patch({"version":1, "avatarId":"frog", "favorites":["capi_traffic", "capi_wait"]})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.session_epoch, session_epoch)
        self.assertEqual(self.user.roles, ["alumno"])
        second = Client(); second.force_login(self.user)
        self.assertEqual(second.get(URL, **self.headers).json()["preferences"], response.json()["preferences"])
        self.assertEqual(record(self.other)["favorites"], [])
        self.assertEqual(AccessEvent.objects.filter(action="preferences_changed", user=self.user).count(), 1)

    def test_partial_updates_do_not_reset_unrelated_preferences(self):
        self.assertEqual(self.patch({"version":1, "avatarId":"flower"}).status_code, 200)
        self.assertEqual(self.patch({"version":2, "favorites":["capi_wait"]}).status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(record(self.user), {"avatarId":"flower", "favorites":["capi_wait"], "version":3, "configured":True})

    def test_conflict_retains_server_data_and_same_retry_is_idempotent(self):
        data = {"version":1, "favorites":["capi_wait", "capi_traffic"]}
        first = self.patch(data)
        replay = self.patch(data)
        self.assertEqual(first.json()["preferences"], replay.json()["preferences"])
        conflict = self.patch({"version":1, "favorites":["capi_motor"]})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["preferences"]["favorites"], data["favorites"])
        self.assertEqual(self.patch({"version":999, "favorites":data["favorites"]}).status_code, 409)

    def test_invalid_catalog_fields_duplicates_and_sizes_are_atomic(self):
        bad = [
            {"version":1,"avatarId":"https://example.invalid/photo.png"},
            {"version":1,"avatarId":{}}, {"version":True,"avatarId":"frog"},
            {"version":1,"roles":["administrador"]}, {"version":1,"userId":str(self.other.pk)},
            {"version":1,"favorites":["capi_start"]}, {"version":1,"favorites":["unknown"]},
            {"version":1,"favorites":["capi_wait","capi_wait"]}, {"version":1,"favorites":[{}]},
            {"version":1,"favorites":"capi_wait"}, {"version":1},
        ]
        for body in bad:
            with self.subTest(body=body): self.assertEqual(self.patch(body).status_code, 400)
        for body in ('{"version":1,"version":1,"avatarId":"frog"}', '{"version":1,"avatarId":"' + 'x'*5000 + '"}'):
            self.assertEqual(self.client.patch(URL, body, content_type="application/json", **self.headers).status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.preference_version, 1)
        self.assertEqual(AccessEvent.objects.filter(action="preferences_changed").count(), 0)

    def test_own_account_header_even_for_admin(self):
        self.assertEqual(self.client.get(URL).status_code, 409)
        self.assertEqual(self.patch({"version":1,"avatarId":"frog"},headers={"HTTP_X_CAPI_ACCOUNT":str(self.other.pk)}).status_code, 409)
        self.user.is_student=False; self.user.is_administrator=True; self.user.save(); self.client.force_login(self.user)
        self.assertEqual(self.client.get(URL, HTTP_X_CAPI_ACCOUNT=str(self.other.pk)).status_code, 409)
        self.assertEqual(self.patch({"version":1,"avatarId":"frog"}).status_code, 200)

    def test_csrf_and_revocation(self):
        browser = Client(enforce_csrf_checks=True); browser.force_login(self.user)
        self.assertEqual(self.patch({"version":1,"avatarId":"frog"},client=browser).status_code, 403)
        csrf = browser.get(URL, **self.headers).json()["csrfToken"]
        self.assertEqual(self.patch({"version":1,"avatarId":"frog"},client=browser,headers={**self.headers,"HTTP_X_CSRFTOKEN":csrf}).status_code, 200)
        self.user.is_active=False; self.user.save()
        self.assertEqual(self.client.get(URL, **self.headers).status_code, 401)
        self.assertEqual(self.patch({"version":2,"avatarId":"flower"}).status_code, 401)

    def test_temporary_password_cannot_use_preferences(self):
        self.user.must_change_password=True; self.user.save(); self.client.force_login(self.user)
        self.assertEqual(self.client.get(URL, **self.headers).status_code, 403)
        self.assertEqual(self.patch({"version":1,"avatarId":"frog"}).status_code, 403)

    def test_retired_catalog_entries_do_not_prevent_reading(self):
        self.user.avatar_id="removed"; self.user.favorite_blocks=["removed","capi_wait","capi_start","capi_wait",{}]; self.user.save()
        result = self.client.get(URL, **self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["preferences"]["avatarId"], "capybara")
        self.assertEqual(result.json()["preferences"]["favorites"], ["capi_wait"])


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class ConcurrentPreferenceTests(TransactionTestCase):
    def test_only_one_conflicting_update_wins(self):
        user = User.objects.create_user("luna", password=PASSWORD, display_name="Luna", must_change_password=False)
        clients = [Client(),Client()]
        for client in clients: client.force_login(user)
        barrier = Barrier(2)
        def update(index):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return clients[index].patch(URL,json.dumps({"version":1,"avatarId":["frog","flower"][index]}),content_type="application/json",HTTP_X_CAPI_ACCOUNT=str(user.pk)).status_code
            finally: close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(update,[0,1]))
        self.assertEqual(sorted(results), [200,409])
        user.refresh_from_db(); self.assertEqual(user.preference_version, 2)
