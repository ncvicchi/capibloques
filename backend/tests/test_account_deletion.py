import hashlib
import io
import json
import uuid
import zipfile
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from accounts.deletion import summary
from accounts.management_api import record
from accounts.models import ManagementEvent, User
from courses.models import Course, Membership
from projects.models import Project, ProjectEvent
from projects.validation import document
from .test_accounts import FAST_HASHERS, PASSWORD
from .test_projects import EXAMPLES


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class AccountDeletionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", display_name="Admin", password=PASSWORD, must_change_password=False, is_administrator=True, is_student=False)
        self.target = User.objects.create_user("luna", display_name="Luna", password=PASSWORD, must_change_password=False, is_active=False)
        self.other = User.objects.create_user("sol", display_name="Sol", password=PASSWORD, must_change_password=False)
        self.course = Course.objects.create(name="Robótica")
        for index in range(2):
            Project.objects.create(owner=self.target, document=EXAMPLES[index], title=EXAMPLES[index]["metadata"]["title"], size_bytes=document(EXAMPLES[index]), course=self.course if index else None, trashed_at=timezone.now() if index else None, last_operation=uuid.uuid4(), last_digest="fixture")
        self.unrelated = Project.objects.create(owner=self.other, document=EXAMPLES[0], title="Ajeno", size_bytes=document(EXAMPLES[0]), last_operation=uuid.uuid4(), last_digest="fixture")
        self.client = Client(HTTP_X_CAPI_ACCOUNT=str(self.admin.pk)); self.client.force_login(self.admin)
        self.url = f"/api/management/users/{self.target.pk}/deletion/"

    def payload(self, receipt="", **changes):
        return {"version": summary(self.target)["version"], "backupReceipt": receipt, "confirmationAlias": "luna", "understandsLocalDrafts": True, "understandsPermanent": True, **changes}

    def backup(self, **changes):
        return self.client.post(self.url + "backup/", {"version": summary(self.target)["version"], "confirmsPrivateBackup": True, **changes}, content_type="application/json")

    def receipt(self):
        response = self.backup(); self.assertEqual(response.status_code, 200, getattr(response, "content", None))
        receipt = response["X-Capi-Backup-Receipt"]
        # Agotar el wrapper del Client cierra el archivo y preserva la conexión
        # transaccional de TestCase. close() manual emitiría request_finished dos veces.
        for _ in response.streaming_content:
            pass
        self.assertTrue(response.file_to_stream.closed)
        return receipt

    def remove(self, data=None):
        return self.client.delete(self.url, data or self.payload(), content_type="application/json")

    def test_preview_counts_without_documents_or_passwords(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["projects"]["count"], 2)
        self.assertEqual(data["projects"]["active"], 1)
        self.assertEqual(data["projects"]["trash"], 1)
        self.assertTrue(data["canDelete"])
        self.assertNotIn("document", response.content.decode())
        self.assertNotIn(self.target.password, response.content.decode())
        self.assertIn("no-store", response["Cache-Control"])

    def test_zip_contains_all_portable_projects_hashes_and_can_reimport(self):
        response = self.backup()
        self.assertEqual(response.status_code, 200)
        contents = b"".join(response.streaming_content)
        self.assertTrue(response.file_to_stream.closed)
        self.assertEqual(hashlib.sha256(contents).hexdigest(), response["X-Capi-Backup-SHA256"])
        with zipfile.ZipFile(io.BytesIO(contents)) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(manifest["account"]["alias"], "luna")
            self.assertNotIn("password", manifest["account"])
            self.assertEqual(len(manifest["projects"]), 2)
            self.assertEqual(sum(item["trashedAt"] is not None for item in manifest["projects"]), 1)
            self.assertIn("LEEME.txt", archive.namelist())
            client = Client(HTTP_X_CAPI_ACCOUNT=str(self.other.pk)); client.force_login(self.other)
            for entry in manifest["projects"]:
                raw = archive.read(entry["file"])
                self.assertEqual(hashlib.sha256(raw).hexdigest(), entry["sha256"])
                sample = json.loads(raw); self.assertGreater(document(sample), 0)
                self.assertNotIn("owner", sample); self.assertNotIn("course", sample)
                restored = client.post("/api/projects/", {"id": str(uuid.uuid4()), "operationId": str(uuid.uuid4()), "document": sample}, content_type="application/json")
                self.assertEqual(restored.status_code, 201, restored.content)
                self.assertNotEqual(restored.json()["project"]["id"], entry["id"])
                self.assertIsNone(restored.json()["project"]["course"])

    def test_delete_exact_owner_with_current_receipt_and_audit(self):
        target_id = self.target.pk
        response = self.remove(self.payload(self.receipt()))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["projectsDeleted"], 2)
        self.assertFalse(User.objects.filter(pk=target_id).exists())
        self.assertEqual(list(Project.objects.values_list("id", flat=True)), [self.unrelated.pk])
        self.assertTrue(Course.objects.filter(pk=self.course.pk).exists())
        self.assertEqual(ProjectEvent.objects.filter(action="account_deleted").count(), 2)
        self.assertEqual(ManagementEvent.objects.filter(target_id_snapshot=target_id, action="deleted").count(), 1)

    def test_requires_inactive_no_memberships_and_exact_confirmations(self):
        self.target.is_active = True; self.target.save()
        self.assertFalse(self.client.get(self.url).json()["canDelete"])
        self.assertEqual(self.backup().status_code, 400)
        self.assertEqual(self.remove().status_code, 400)
        self.target.is_active = False; self.target.save()
        member = Membership.objects.create(user=self.target, course=self.course, role="alumno")
        self.assertEqual(self.remove().status_code, 400)
        member.delete()
        receipt = self.receipt()
        for changes in [{"confirmationAlias": "LUNA"}, {"understandsLocalDrafts": False}, {"understandsPermanent": False}]:
            self.assertEqual(self.remove(self.payload(receipt, **changes)).status_code, 400)
        self.assertEqual(Project.objects.filter(owner=self.target).count(), 2)

    def test_missing_tampered_expired_or_other_actor_receipt_cannot_delete(self):
        self.assertEqual(self.remove().status_code, 400)
        self.assertEqual(self.remove(self.payload("fake" )).status_code, 409)
        receipt = self.receipt()
        with patch("django.core.signing.time.time", return_value=timezone.now().timestamp() + 601):
            self.assertEqual(self.remove(self.payload(receipt)).status_code, 409)
        other_admin = User.objects.create_user("admin2", display_name="Admin2", password=PASSWORD, must_change_password=False, is_administrator=True, is_student=False)
        self.client.force_login(other_admin); self.client.defaults["HTTP_X_CAPI_ACCOUNT"] = str(other_admin.pk)
        self.assertEqual(self.remove(self.payload(receipt)).status_code, 409)
        self.assertTrue(User.objects.filter(pk=self.target.pk).exists())

    def test_stale_project_account_and_course_metadata_invalidate_backup(self):
        for mutate in ["project", "account", "course"]:
            receipt = self.receipt(); payload = self.payload(receipt)
            if mutate == "project":
                project = self.target.projects.first(); project.revision += 1; project.save()
            elif mutate == "account":
                self.target.display_name = "Luna nueva"; self.target.save()
            else:
                self.course.name = "Robótica nueva"; self.course.save()
            self.assertEqual(self.remove(payload).status_code, 400)
            self.assertEqual(self.remove(self.payload(receipt)).status_code, 409)

    def test_receipt_tied_to_actor_epoch_even_after_logging_in_again(self):
        receipt = self.receipt()
        self.admin.set_password("Otra frase segura para prueba 734"); self.admin.save()
        self.client.force_login(self.admin)
        self.assertEqual(self.remove(self.payload(receipt)).status_code, 409)

    def test_backup_failure_and_delete_failure_rollback_without_data_loss(self):
        with patch("accounts.deletion.tempfile.TemporaryFile", side_effect=OSError("full")):
            self.assertEqual(self.backup().status_code, 503)
        self.assertEqual(ManagementEvent.objects.count(), 0)
        receipt = self.receipt()
        with patch.object(User, "delete", side_effect=ValidationError("Relación protegida")):
            self.assertEqual(self.remove(self.payload(receipt)).status_code, 400)
        self.assertEqual(self.target.projects.count(), 2)
        self.assertEqual(ProjectEvent.objects.count(), 0)
        self.assertEqual(ManagementEvent.objects.filter(action="deleted").count(), 0)

    def test_legacy_endpoint_cannot_bypass_backup_guard(self):
        response = self.client.delete(self.url.removesuffix("deletion/"), {"version": record(self.target)["version"], "confirmationAlias": "luna", "understandsLocalDrafts": True}, content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.target.projects.count(), 2)

    def test_empty_account_does_not_need_zip_but_still_requires_confirmations(self):
        self.target.projects.all().delete()  # Datos sintéticos, nunca una cuenta DEV.
        self.assertEqual(self.remove(self.payload(understandsPermanent=False)).status_code, 400)
        self.assertEqual(self.remove().status_code, 200)

    def test_permissions_account_precondition_and_csrf(self):
        for actor, expected in [(None, 401), (self.other, 403)]:
            client = Client()
            if actor: client.force_login(actor)
            for path, method in [(self.url, "get"), (self.url, "delete"), (self.url + "backup/", "post")]:
                self.assertEqual(getattr(client, method)(path, {}, content_type="application/json").status_code, expected)
        self.assertEqual(self.client.get(self.url, HTTP_X_CAPI_ACCOUNT=str(self.other.pk)).status_code, 400)
        client = Client(enforce_csrf_checks=True, HTTP_X_CAPI_ACCOUNT=str(self.admin.pk)); client.force_login(self.admin)
        self.assertEqual(client.post(self.url + "backup/", {}, content_type="application/json").status_code, 403)
        self.assertEqual(client.delete(self.url, self.payload(), content_type="application/json").status_code, 403)

    def test_backup_requires_private_consent_and_respects_quota(self):
        self.assertEqual(self.backup(confirmsPrivateBackup=False).status_code, 400)
        project = self.target.projects.first(); project.size_bytes = 50_000_001; project.save()
        self.assertEqual(self.backup().status_code, 400)
        self.assertEqual(self.target.projects.count(), 2)
