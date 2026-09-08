import copy
import hashlib
import json
from datetime import timedelta
from pathlib import Path
import tempfile
import uuid
from unittest.mock import patch

from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from django.db import close_old_connections

from accounts.models import access_lock
from compiler.models import Build, CompilerConfig, CompilerEvent
from compiler.services import cipher, dispatch, retire_project_builds, sweep
from projects.models import Project
from .test_accounts import FAST_HASHERS
from .test_projects import ProjectTests


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class CompilerTests(TestCase):
    payload = ProjectTests.payload
    create = ProjectTests.create

    def setUp(self):
        ProjectTests.setUp(self)
        self.project = self.create()
        CompilerConfig.objects.create(recipe="a" * 64, paused=False, runner_seen=timezone.now())

    def request_data(self, **changes):
        return {"id": str(uuid.uuid4()), "projectId": self.project["id"], "revision": self.project["revision"], "framework": "arduino", "wifi": None, "wiringReviewed": True, **changes}

    def enqueue(self, data=None):
        response = self.client.post("/api/builds/", data or self.request_data(), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["job"]

    def test_immutable_snapshot_and_idempotency(self):
        data = self.request_data()
        job = self.enqueue(data)
        self.assertEqual(self.client.post("/api/builds/", data, content_type="application/json").status_code, 200)
        self.assertEqual(Build.objects.count(), 1)
        self.assertEqual(self.client.post("/api/builds/", {**data, "framework": "esp-idf"}, content_type="application/json").status_code, 409)
        project = Project.objects.get(pk=self.project["id"])
        before = copy.deepcopy(project.document)
        project.document["metadata"]["title"] = "Nueva versión"; project.revision += 1; project.save()
        self.assertEqual(Build.objects.get(pk=job["id"]).document, before)
        self.assertEqual(self.client.post("/api/builds/", self.request_data(), content_type="application/json").status_code, 409)

    def test_private_even_for_admin_teacher_and_other_account(self):
        job = self.enqueue()
        for actor in (self.other, self.admin, self.teacher):
            client = Client(HTTP_X_CAPI_ACCOUNT=str(actor.pk)); client.force_login(actor)
            self.assertEqual(client.get("/api/builds/").json()["jobs"], [])
            for suffix in ("", "download/"):
                self.assertEqual(client.get(f"/api/builds/{job['id']}/{suffix}").status_code, 404)
            self.assertEqual(client.delete(f"/api/builds/{job['id']}/").status_code, 404)
            self.assertEqual(client.post("/api/builds/", self.request_data(), content_type="application/json").status_code, 404)
        self.assertEqual(self.client.get("/api/builds/", HTTP_X_CAPI_ACCOUNT=str(self.other.pk)).status_code, 409)
        self.assertEqual(Client().get("/api/builds/").status_code, 401)

    def test_secret_encrypted_replay_keyed_and_cleared_on_cancel(self):
        data = self.request_data(wifi={"ssid": "Synthetic private network", "password": 'synthetic"pass', "consent": True})
        job = self.enqueue(data)
        stored = Build.objects.get(pk=job["id"])
        self.assertNotIn("synthetic", stored.wifi_encrypted)
        self.assertEqual(json.loads(cipher().decrypt(stored.wifi_encrypted.encode()))["password"], data["wifi"]["password"])
        self.assertNotIn(data["wifi"]["ssid"], json.dumps(stored.document))
        self.assertNotIn(data["wifi"]["password"], self.client.get("/api/builds/").content.decode())
        response = self.client.delete(f"/api/builds/{job['id']}/")
        self.assertEqual(response.status_code, 200)
        stored.refresh_from_db()
        self.assertEqual(stored.wifi_encrypted, ""); self.assertIsNone(stored.document)

    def test_limits_pause_admin_optimism_and_wiring(self):
        self.assertEqual(self.client.get("/api/management/compiler/").status_code, 403)
        self.assertEqual(self.client.post("/api/builds/", self.request_data(wiringReviewed=False), content_type="application/json").status_code, 400)
        for _ in range(3): self.enqueue()
        self.assertEqual(self.client.post("/api/builds/", self.request_data(), content_type="application/json").status_code, 400)
        client = Client(HTTP_X_CAPI_ACCOUNT=str(self.admin.pk)); client.force_login(self.admin)
        value = {"revision": 1, "concurrency": 2, "paused": False}
        self.assertEqual(client.put("/api/management/compiler/", value, content_type="application/json").status_code, 400)
        value.update(concurrency=1, paused=True)
        self.assertEqual(client.put("/api/management/compiler/", value, content_type="application/json").status_code, 200)
        self.assertEqual(client.put("/api/management/compiler/", value, content_type="application/json").status_code, 409)
        self.assertEqual(CompilerEvent.objects.count(), 1)
        self.assertIsNone(dispatch("claim", {})["job"])

    def test_expired_lease_never_releases_slot_stale_attempt_rejected(self):
        first = self.enqueue(); self.enqueue()
        claim = dispatch("claim", {})["job"]
        self.assertEqual(claim["id"], first["id"])
        Build.objects.filter(pk=first["id"]).update(lease_until=timezone.now() - timedelta(minutes=3))
        self.assertIsNone(dispatch("claim", {})["job"])
        self.assertTrue(dispatch("inspect", {})["active"][0]["expired"])
        result = dispatch("finish", {"id": first["id"], "attempt": str(uuid.uuid4()), "terminated": True})
        self.assertFalse(result["accepted"])
        with self.assertRaises(Exception): dispatch("finish", {"id": first["id"], "attempt": claim["attempt"]})
        self.assertIsNone(dispatch("claim", {})["job"])
        result = dispatch("finish", {"id": first["id"], "attempt": claim["attempt"], "terminated": True, "reason": "restart"})
        self.assertEqual(result["state"], "failed")
        self.assertIsNotNone(dispatch("claim", {})["job"])

    def test_revoke_and_purge_active_keeps_capacity_until_terminated(self):
        job = self.enqueue(self.request_data(wifi={"ssid": "Synthetic", "password": "test-only-password", "consent": True}))
        claim = dispatch("claim", {})["job"]
        self.assertEqual(self.client.delete(f"/api/builds/{job['id']}/").status_code, 409)
        project = Project.objects.get(pk=self.project["id"])
        with access_lock(): retire_project_builds(project)
        current = Build.objects.get(pk=job["id"])
        self.assertTrue(current.cancel_requested); self.assertEqual(current.state, "building")
        self.assertEqual(current.wifi_encrypted, ""); self.assertIsNone(current.document)
        self.assertTrue(dispatch("heartbeat", {"id": job["id"], "attempt": claim["attempt"]})["cancel"])
        self.assertEqual(dispatch("finish", {"id": job["id"], "attempt": claim["attempt"], "terminated": True, "success": True})["state"], "cancelled")

    def test_publish_download_expiry_and_cache_private_without_credentials(self):
        job = self.enqueue()
        claim = dispatch("claim", {})["job"]
        with tempfile.TemporaryDirectory() as directory, override_settings(COMPILER_ARTIFACT_ROOT=directory):
            contents = b"synthetic artifact for API transport"
            path = Path(directory) / (claim["attempt"] + ".zip"); path.write_bytes(contents)
            checksum = hashlib.sha256(contents).hexdigest()
            finished = dispatch("finish", {"id": job["id"], "attempt": claim["attempt"], "terminated": True, "success": True, "sha256": checksum})
            self.assertEqual(finished["state"], "ready")
            response = self.client.get(f"/api/builds/{job['id']}/download/")
            self.assertEqual(response.status_code, 200); self.assertEqual(b"".join(response.streaming_content), contents)
            self.assertIn("no-store", response["Cache-Control"])
            second = self.enqueue()
            self.assertEqual(second["state"], "ready")
            self.assertEqual(Build.objects.get(pk=second["id"]).artifact, uuid.UUID(claim["attempt"]))
            Build.objects.filter(pk=job["id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
            self.assertEqual(self.client.get(f"/api/builds/{job['id']}/download/").status_code, 410)
            self.assertEqual(self.client.get(f"/api/builds/{second['id']}/download/").status_code, 200)

    def test_wifi_invalid_inputs_and_source_injection_rejected(self):
        for wifi in ({"ssid": "x", "password": "short", "consent": True}, {"ssid": "x", "password": "long-enough", "consent": False}, {"ssid": "x\x00", "password": "", "consent": True}):
            self.assertEqual(self.client.post("/api/builds/", self.request_data(wifi=wifi), content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post("/api/builds/", {**self.request_data(), "source": "malicious"}, content_type="application/json").status_code, 400)

    def test_expiration_erases_pending_credentials_and_snapshot(self):
        job = self.enqueue(self.request_data(wifi={"ssid": "Synthetic", "password": "", "consent": True}))
        Build.objects.filter(pk=job["id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
        with access_lock(): sweep()
        current = Build.objects.get(pk=job["id"])
        self.assertEqual(current.state, "expired"); self.assertEqual(current.wifi_encrypted, ""); self.assertIsNone(current.document)

    def test_csrf_real_client_cannot_enqueue_without_token(self):
        client = Client(enforce_csrf_checks=True, HTTP_X_CAPI_ACCOUNT=str(self.owner.pk)); client.force_login(self.owner)
        self.assertEqual(client.post("/api/builds/", self.request_data(), content_type="application/json").status_code, 403)


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class CompilerConcurrencyTests(TransactionTestCase):
    def test_parallel_claims_are_globally_serialized(self):
        from concurrent.futures import ThreadPoolExecutor
        from accounts.models import User
        from .test_projects import EXAMPLES
        from projects.validation import document
        CompilerConfig.objects.create(recipe="a" * 64, paused=False, concurrency=2, ceiling=2)
        for index in range(3):
            owner = User.objects.create_user(f"queue{index}", display_name="Synthetic", must_change_password=False)
            project = Project.objects.create(owner=owner, title="Synthetic", document=EXAMPLES[0], size_bytes=document(EXAMPLES[0]), last_operation=uuid.uuid4(), last_digest="0" * 64)
            for _ in range(2):
                Build.objects.create(owner_id_snapshot=owner.pk, project_id_snapshot=project.pk, project_revision=1, title="Synthetic", framework="arduino", recipe="a" * 64, request_digest="a" * 64, cache_key="b" * 64, document=project.document, expires_at=timezone.now() + timedelta(hours=1))
        def claim():
            close_old_connections()
            try: return dispatch("claim", {})["job"]
            finally: close_old_connections()
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: claim(), range(4)))
        self.assertEqual(sum(result is not None for result in results), 2)
        self.assertEqual(Build.objects.filter(state="building").count(), 2)
        self.assertEqual(Build.objects.filter(state="building").values("owner_id_snapshot").distinct().count(), 2)
        # Reducing the cap does not terminate either active attempt.
        CompilerConfig.objects.filter(pk=1).update(concurrency=1)
        self.assertIsNone(claim())
        active = Build.objects.filter(state="building").first()
        served_owner = active.owner_id_snapshot
        dispatch("finish", {"id": str(active.pk), "attempt": str(active.attempt), "terminated": True})
        self.assertIsNone(claim())
        remaining = Build.objects.filter(state="building").first()
        dispatch("finish", {"id": str(remaining.pk), "attempt": str(remaining.attempt), "terminated": True})
        next_job = claim()
        self.assertNotIn(Build.objects.get(pk=next_job["id"]).owner_id_snapshot, [served_owner, remaining.owner_id_snapshot])
