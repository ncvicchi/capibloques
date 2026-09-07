import copy
import json
import uuid
from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import Client, TestCase, override_settings

from accounts.models import User
from projects.models import Project, ProjectEvent
from projects.validation import document
from .test_accounts import FAST_HASHERS, PASSWORD

EXAMPLES = json.loads((Path(__file__).parent / "fixtures/projects-v2.json").read_text(encoding="utf-8"))


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class ProjectTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("luna", display_name="Luna", password=PASSWORD, must_change_password=False)
        self.other = User.objects.create_user("sol", display_name="Sol", password=PASSWORD, must_change_password=False)
        self.admin = User.objects.create_user("admin", display_name="Admin", password=PASSWORD, must_change_password=False, is_administrator=True, is_student=False)
        self.teacher = User.objects.create_user("profe", display_name="Profe", password=PASSWORD, must_change_password=False, is_teacher=True, is_student=False)
        self.client.force_login(self.owner)
        self.client.defaults["HTTP_X_CAPI_ACCOUNT"] = str(self.owner.pk)
        self.root = "/api/projects/"

    def payload(self, example=0):
        return {"id": str(uuid.uuid4()), "operationId": str(uuid.uuid4()), "document": copy.deepcopy(EXAMPLES[example])}

    def create(self, data=None):
        data = data or self.payload()
        response = self.client.post(self.root, data, content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["project"]

    def url(self, project, action=""):
        return f"{self.root}{project['id']}/{action + '/' if action else ''}"

    def action(self, project, action, **extra):
        return self.client.post(self.url(project, action), {"revision": project["revision"], "operationId": str(uuid.uuid4()), **extra}, content_type="application/json")

    def test_real_client_examples_roundtrip_and_private_metadata(self):
        for index, example in enumerate(EXAMPLES):
            project = self.create(self.payload(index))
            response = self.client.get(self.url(project))
            self.assertEqual(response.json()["document"], example)
            self.assertIn("no-store", response["Cache-Control"])
        listing = self.client.get(self.root).json()
        self.assertEqual(listing["count"], 4)
        self.assertNotIn("document", listing["projects"][0])
        self.assertEqual(ProjectEvent.objects.count(), 4)

    def test_other_students_teachers_and_admin_cannot_access_or_mutate_private_projects(self):
        project = self.create()
        for actor in [self.other, self.teacher, self.admin]:
            client = Client(HTTP_X_CAPI_ACCOUNT=str(actor.pk))
            client.force_login(actor)
            self.assertEqual(client.get(self.root).json()["count"], 0)
            foreign = client.get(self.url(project))
            self.assertEqual(foreign.status_code, 404)
            self.assertEqual(foreign.json(), client.get(f"{self.root}{uuid.uuid4()}/").json())
            for action in ["rename", "trash", "restore"]:
                self.assertEqual(client.post(self.url(project, action), {}, content_type="application/json").status_code, 404)
            self.assertEqual(client.put(self.url(project), {}, content_type="application/json").status_code, 404)
            data = self.payload(); data["id"] = project["id"]
            self.assertEqual(client.post(self.root, data, content_type="application/json").status_code, 404)

    def test_anonymous_account_precondition_and_password_change(self):
        self.assertEqual(Client().get(self.root).status_code, 401)
        self.assertEqual(self.client.get(self.root, HTTP_X_CAPI_ACCOUNT=str(self.other.pk)).status_code, 409)
        self.assertEqual(self.client.post(self.root, self.payload(), content_type="application/json", HTTP_X_CAPI_ACCOUNT=str(self.other.pk)).status_code, 409)
        self.owner.must_change_password = True; self.owner.save()
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.root).status_code, 403)
        self.assertEqual(Project.objects.count(), 0)

    def test_deactivation_revokes_private_access(self):
        project = self.create()
        self.owner.is_active = False; self.owner.save()
        self.assertEqual(self.client.get(self.url(project)).status_code, 401)
        self.assertEqual(Project.objects.count(), 1)

    def test_create_and_save_retries_are_idempotent_and_atomic(self):
        data = self.payload(); project = self.create(data)
        self.assertEqual(self.client.post(self.root, data, content_type="application/json").json()["project"], project)
        self.assertEqual(ProjectEvent.objects.count(), 1)
        update = {"operationId": str(uuid.uuid4()), "revision": 1, "document": data["document"]}
        update["document"]["metadata"]["title"] = "Semáforo nuevo"
        first = self.client.put(self.url(project), update, content_type="application/json")
        again = self.client.put(self.url(project), update, content_type="application/json")
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(first.json(), again.json())
        self.assertEqual(first.json()["project"]["revision"], 2)
        self.assertEqual(ProjectEvent.objects.count(), 2)
        update["document"]["metadata"]["title"] = "No autorizado como reintento"
        self.assertEqual(self.client.put(self.url(project), update, content_type="application/json").status_code, 409)
        self.assertEqual(Project.objects.get().title, "Semáforo nuevo")

    def test_stale_revision_never_overwrites_or_resurrects(self):
        project = self.create()
        renamed = self.action(project, "rename", title="Nombre en otra pestaña")
        self.assertEqual(renamed.status_code, 200)
        update = {"operationId": str(uuid.uuid4()), "revision": 1, "document": EXAMPLES[0]}
        self.assertEqual(self.client.put(self.url(project), update, content_type="application/json").json()["code"], "stale_revision")
        trashed = self.action(renamed.json()["project"], "trash").json()["project"]
        update["revision"] = trashed["revision"]
        self.assertEqual(self.client.put(self.url(project), update, content_type="application/json").json()["code"], "trashed")
        self.assertEqual(Project.objects.get().title, "Nombre en otra pestaña")

    def test_trash_export_restore_and_action_retry_binding(self):
        project = self.create()
        operation = {"revision": 1, "operationId": str(uuid.uuid4())}
        trashed = self.client.post(self.url(project, "trash"), operation, content_type="application/json")
        self.assertEqual(self.client.post(self.url(project, "trash"), operation, content_type="application/json").json(), trashed.json())
        self.assertEqual(self.client.post(self.url(project, "restore"), operation, content_type="application/json").status_code, 409)
        self.assertEqual(self.client.get(self.root).json()["count"], 0)
        self.assertEqual(self.client.get(self.root + "?state=trash").json()["count"], 1)
        self.assertEqual(self.client.get(self.url(project)).json()["document"], EXAMPLES[0])
        restored = self.action(trashed.json()["project"], "restore")
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(self.client.get(self.root).json()["count"], 1)

    def test_json_limits_duplicate_keys_and_unknown_properties(self):
        for raw in ['{}', '{"id":1,"id":2}', '{"a":NaN}', '[' * 1100 + '0' + ']' * 1100]:
            self.assertEqual(self.client.post(self.root, raw, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.post(self.root, 'x' * 2_004_097, content_type="application/json").status_code, 413)
        self.assertEqual(self.client.post(self.root, 'x', content_type="text/plain").status_code, 413)
        data = self.payload(); data["owner"] = str(self.other.pk)
        self.assertEqual(self.client.post(self.root, data, content_type="application/json").status_code, 400)
        self.assertEqual(Project.objects.count(), 0)

    def test_malformed_documents_never_modify_stored_version(self):
        project = self.create()
        invalid = []
        for key, value in [("schemaVersion", True), ("workspace", {"blocks": {"languageVersion": False, "blocks": []}}), ("target", {}), ("scene", {})]:
            sample = copy.deepcopy(EXAMPLES[0]); sample[key] = value; invalid.append(sample)
        sample = copy.deepcopy(EXAMPLES[0]); sample["metadata"]["title"] = "\x00"; invalid.append(sample)
        sample = copy.deepcopy(EXAMPLES[0]); sample["workspace"] = {"__proto__": {}}; invalid.append(sample)
        sample = copy.deepcopy(EXAMPLES[0]); sample["workspace"]["blocks"]["blocks"][0]["type"] = "execute_python"; invalid.append(sample)
        for sample in invalid:
            response = self.client.put(self.url(project), {"revision": 1, "operationId": str(uuid.uuid4()), "document": sample}, content_type="application/json")
            self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(Project.objects.get().revision, 1)
        self.assertEqual(ProjectEvent.objects.count(), 1)

    def test_quota_includes_trash_and_updates_do_not_consume_another_slot(self):
        with patch("projects.views.MAX_PROJECTS", 1):
            project = self.create()
            self.assertEqual(self.action(project, "rename", title="Permitido").status_code, 200)
            project = self.client.get(self.url(project)).json()["project"]
            self.action(project, "trash")
            self.assertEqual(self.client.post(self.root, self.payload(), content_type="application/json").status_code, 400)
        with patch("projects.views.MAX_ACCOUNT_BYTES", 1):
            self.assertEqual(self.client.post(self.root, self.payload(), content_type="application/json").status_code, 400)
        self.assertEqual(Project.objects.count(), 1)

    def test_accounts_with_projects_require_deactivation_not_cascade_delete(self):
        self.create()
        with self.assertRaisesMessage(ValidationError, "proyectos"):
            self.owner.delete()
        self.owner.is_active = False; self.owner.save()
        self.assertEqual(Project.objects.count(), 1)

    def test_search_pagination_and_invalid_filters(self):
        for i in range(21):
            data = self.payload(); data["document"]["metadata"]["title"] = f"Semáforo {i}"; self.create(data)
        self.assertEqual(len(self.client.get(self.root).json()["projects"]), 20)
        self.assertEqual(len(self.client.get(self.root + "?page=2").json()["projects"]), 1)
        self.assertEqual(self.client.get(self.root + "?q=20").json()["count"], 1)
        for query in ["page=0", "page=no", "state=all", "q=" + "x" * 81]:
            self.assertEqual(self.client.get(self.root + "?" + query).status_code, 400)

    def test_csrf_required_for_mutations(self):
        client = Client(enforce_csrf_checks=True, HTTP_X_CAPI_ACCOUNT=str(self.owner.pk))
        client.force_login(self.owner)
        self.assertEqual(client.post(self.root, self.payload(), content_type="application/json").status_code, 403)
        token = client.get("/api/auth/editor-session/").json()["csrfToken"]
        self.assertEqual(client.post(self.root, self.payload(), content_type="application/json", HTTP_X_CSRFTOKEN=token).status_code, 201)

    def test_storage_accepts_incomplete_hardware_but_rejects_duplicate_device_identity(self):
        sample = copy.deepcopy(EXAMPLES[0])
        for key in sample["scene"]["devices"][0]["pins"]:
            sample["scene"]["devices"][0]["pins"][key] = None
        self.assertGreater(document(sample), 0)
        sample["scene"]["devices"].append(copy.deepcopy(sample["scene"]["devices"][0]))
        with self.assertRaises(ValidationError):
            document(sample)
