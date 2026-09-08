"""Synthetic end-to-end DEV probe. No real user/project can match its guards."""
import copy
import hashlib
import io
import json
from pathlib import Path
import time
import urllib.request
import uuid
import zipfile

from django.core.management.base import BaseCommand, CommandError
from django.test import Client

from accounts.models import User, access_lock
from compiler.models import Build
from compiler.views import metadata
from projects.models import Project
from projects.views import retire_project


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument("action", choices=["create", "status", "verify", "measure", "cleanup"])
        parser.add_argument("--owner")
        parser.add_argument("--framework", choices=["arduino", "esp-idf"], default="arduino")
        parser.add_argument("--wifi", action="store_true")

    def handle(self, *args, **options):
        if options["action"] == "create":
            owner = User.objects.create_user("compiler-probe-" + uuid.uuid4().hex[:12], display_name="Prueba sintética de compilación", password=None, must_change_password=False)
            client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost", HTTP_X_CAPI_ACCOUNT=str(owner.pk))
            client.force_login(owner)
            try:
                csrf = client.get("/api/auth/session/").json()["csrfToken"]
                examples = json.loads((Path(__file__).resolve().parents[3] / "tests/fixtures/projects-v2.json").read_text())
                document = copy.deepcopy(examples[3 if options["wifi"] else 0])
                document["metadata"]["title"] = "Prueba sintética: " + options["framework"]
                project_id = str(uuid.uuid4())
                response = client.post("/api/projects/", {"id": project_id, "operationId": str(uuid.uuid4()), "document": document}, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
                if response.status_code != 201: raise CommandError("Synthetic project could not be created")
                data = {"id": str(uuid.uuid4()), "projectId": project_id, "revision": 1, "framework": options["framework"], "wiringReviewed": True,
                        "wifi": {"ssid": "CapiSyntheticNetwork", "password": "synthetic-password-only", "consent": True} if options["wifi"] else None}
                response = client.post("/api/builds/", data, content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
                self.stdout.write(json.dumps({"owner": str(owner.pk), "status": response.status_code, "job": response.json()}))
            finally:
                client.logout()
            return
        try:
            owner = User.objects.get(pk=uuid.UUID(options["owner"]), display_name="Prueba sintética de compilación", username__startswith="compiler-probe-", is_student=True, is_teacher=False, is_administrator=False)
            if owner.has_usable_password() or owner.course_memberships.exists(): raise ValueError
        except (ValueError, User.DoesNotExist, TypeError):
            raise CommandError("Not an exact synthetic probe owner") from None
        jobs = Build.objects.filter(owner_id_snapshot=owner.pk)
        if options["action"] == "status":
            self.stdout.write(json.dumps({"jobs": [metadata(job) for job in jobs]}))
            return
        if options["action"] in ("verify", "measure"):
            client = Client(enforce_csrf_checks=True, HTTP_HOST="localhost", HTTP_X_CAPI_ACCOUNT=str(owner.pk))
            client.force_login(owner)
            try:
                csrf = client.get("/api/auth/session/").json()["csrfToken"]
                if options["action"] == "verify":
                    job = jobs.filter(state="ready").latest("created_at")
                    response = client.get(f"/api/builds/{job.pk}/download/")
                    if response.status_code != 200: raise CommandError("Private download failed")
                    content = b"".join(response.streaming_content)
                    if hashlib.sha256(content).hexdigest() != job.artifact_sha256: raise CommandError("Artifact hash mismatch")
                    with zipfile.ZipFile(io.BytesIO(content)) as archive:
                        manifest = json.loads(archive.read("manifest.json"))
                        if manifest["recipe"] != job.recipe or manifest["framework"] != job.framework: raise CommandError("Recipe mismatch")
                        found = False
                        for part in manifest["parts"]:
                            binary = archive.read(part["path"])
                            if hashlib.sha256(binary).hexdigest() != part["sha256"]: raise CommandError("Part hash mismatch")
                            found |= b"synthetic-password-only" in binary
                        if found != job.contains_wifi: raise CommandError("Synthetic credential presence mismatch")
                        self.stdout.write(json.dumps({"verified": True, "bytes": len(content), "parts": len(manifest["parts"]), "containsSyntheticWifi": found, "metrics": job.metrics}))
                else:
                    # Real HTTP through the same editor proxy; credentials stay
                    # only in this synthetic process, never stdout or disk.
                    cookie = "; ".join(f"{key}={value.value}" for key, value in client.cookies.items())
                    headers = {"Host": "localhost:3000", "Origin": "http://localhost:3000", "Cookie": cookie, "X-Capi-Account": str(owner.pk), "X-CSRFToken": csrf, "Content-Type": "application/json"}
                    samples = []
                    project = owner.projects.get()
                    for tick in range(8):
                        project.refresh_from_db()
                        document = copy.deepcopy(project.document)
                        document["metadata"]["title"] = "Prueba sintética: respuesta " + str(tick)
                        payload = {"operationId": str(uuid.uuid4()), "revision": project.revision, "document": document}
                        active = jobs.filter(state="building").exists()
                        started = time.monotonic()
                        health = urllib.request.urlopen(urllib.request.Request("http://editor:3000/api/health/ready/", headers={"Host": "localhost:3000"}), timeout=12)
                        health.read(); health.close()
                        health_ms = (time.monotonic() - started) * 1000
                        started = time.monotonic()
                        result = urllib.request.urlopen(urllib.request.Request(f"http://editor:3000/api/projects/{project.pk}/", data=json.dumps(payload).encode(), method="PUT", headers=headers), timeout=12)
                        result.read(); result.close()
                        samples.append({"compiling": active, "healthMs": round(health_ms, 1), "saveMs": round((time.monotonic() - started) * 1000, 1)})
                        time.sleep(2)
                    self.stdout.write(json.dumps({"samples": samples}))
            finally:
                client.logout()
            return
        with access_lock():
            if jobs.filter(state="building").exists(): raise CommandError("Wait for actual container termination before cleanup")
            for project in owner.projects.all():
                if not project.title.startswith("Prueba sintética:") or project.course_id: raise CommandError("Unexpected probe project")
            for project in owner.projects.all(): retire_project(None, project, uuid.uuid4(), "synthetic-probe-cleanup")
            owner.delete()
        self.stdout.write("Only this exact synthetic probe account/projects retired; no real user data touched.")
