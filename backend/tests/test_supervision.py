import copy
import io
import json
import uuid
import zipfile
from datetime import timedelta
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.core.exceptions import ValidationError
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.db import connections, close_old_connections
from django.utils import timezone

from accounts.deletion import summary
from accounts.models import User, access_lock
from courses.models import Membership
from projects.models import Project, ProjectRevision, ProjectFeedback
from .test_accounts import FAST_HASHERS
from .test_project_courses import ProjectCourseTests
from .test_projects import EXAMPLES


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class SupervisionTests(TestCase):
    setUp = ProjectCourseTests.setUp
    login = ProjectCourseTests.login
    create = ProjectCourseTests.create
    link = ProjectCourseTests.link

    def root(self, project=None, course=True):
        project_id = (project or self.project)["id"]
        return f"/api/review/{project_id}/"

    def request(self, path="", method="get", data=None, actor=None, course=True):
        return getattr(self.login(actor or self.teacher), method)(self.root() + path + (f"?course={self.course.pk}" if course else ""), data or {}, content_type="application/json")

    def open(self, revision=None, **kwargs):
        return self.request(f"versions/{revision or self.project['revision']}/", "post", **kwargs)

    def comment(self, text="Revisá el tiempo en rojo", revision=None, **kwargs):
        return self.request("feedback/", "post", {"id": str(uuid.uuid4()), "revision": revision or self.project["revision"], "text": text}, **kwargs)

    def save(self, name="Otro guardado", automatic=True):
        sample = copy.deepcopy(EXAMPLES[0]); sample["metadata"]["title"] = name
        result = self.client.put(self.url, {"revision": self.project["revision"], "operationId": str(uuid.uuid4()), "document": sample}, content_type="application/json", HTTP_X_CAPI_SAVE_MODE="automatic" if automatic else "manual")
        self.assertEqual(result.status_code, 200, result.content)
        self.project = result.json()["project"]
        return result

    def test_private_admin_peer_and_unknown_course_denied_every_route(self):
        for shared in [False, True]:
            if shared: self.link()
            for actor in [self.admin, self.peer, self.outside]:
                for path, method, data in [("", "get", None), ("versions/2/", "get", None), ("versions/2/", "post", {}), ("feedback/", "post", {}), (f"feedback/{uuid.uuid4()}/", "patch", {}), ("versions/2/copy/", "post", {})]:
                    self.assertEqual(self.request(path, method, data, actor=actor).status_code, 404)
        self.assertEqual(self.request(course=False).status_code, 404)
        self.assertEqual(self.request(actor=self.owner, course=False).status_code, 200)
        self.assertFalse(ProjectFeedback.objects.exists())

    def test_open_freezes_saved_snapshot_without_changing_original_or_save_identity(self):
        self.link()
        before = Project.objects.get().last_operation
        opened = self.open()
        self.assertEqual(opened.status_code, 200, opened.content)
        self.assertEqual(opened.json()["document"], EXAMPLES[0])
        self.assertEqual(Project.objects.get().last_operation, before)
        self.assertEqual(Project.objects.get().revision, 2)
        self.assertEqual(len([v for v in self.client.get(self.url + "history/").json()["versions"] if v["revision"] == 2]), 1)
        for _ in range(4): self.save()
        self.assertEqual(self.request("versions/2/").json()["document"], EXAMPLES[0])
        result = self.comment(revision=2)
        self.assertEqual(result.status_code, 201, result.content)
        self.assertTrue(ProjectRevision.objects.get(revision=2).pinned)
        self.assertEqual(self.request().json()["project"]["revision"], 6)
        self.assertEqual(self.request().json()["feedback"][0]["revision"], 2)

    def test_comment_is_idempotent_bound_to_actor_body_project_and_pins_history(self):
        self.link(); self.open()
        data = {"id": str(uuid.uuid4()), "revision": 2, "text": "Una devolución"}
        first = self.request("feedback/", "post", data)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.request("feedback/", "post", data).json(), first.json())
        data["text"] = "Cambio oculto"
        self.assertEqual(self.request("feedback/", "post", data).status_code, 409)
        self.assertEqual(ProjectFeedback.objects.count(), 1)
        for index in range(25): self.save(f"Manual {index}", automatic=False)
        self.assertTrue(ProjectRevision.objects.filter(revision=2, pinned=True).exists())
        result = self.client.delete(self.url + "history/2/", {"revision": self.project["revision"], "operationId": str(uuid.uuid4()), "confirmation": "2"}, content_type="application/json")
        self.assertEqual(result.status_code, 400)

    def test_respond_resolve_cancel_equivalent_and_conflicts_do_not_change_project(self):
        self.link(); self.open(); item = self.comment().json()["feedback"]
        original_revision = Project.objects.get().revision
        path = f"feedback/{item['id']}/"
        data = {"operationId": str(uuid.uuid4()), "version": 1, "reply": "Lo probé y ya funciona", "resolved": True}
        self.assertEqual(self.request(path, "patch", data).status_code, 404)
        result = self.request(path, "patch", data, actor=self.owner)
        self.assertEqual(result.status_code, 200, result.content)
        self.assertTrue(result.json()["feedback"]["resolved"])
        self.assertEqual(self.request(path, "patch", data, actor=self.owner).json(), result.json())
        data["operationId"] = str(uuid.uuid4())
        self.assertEqual(self.request(path, "patch", data, actor=self.owner).status_code, 409)
        self.assertEqual(Project.objects.get().revision, original_revision)
        self.assertEqual(ProjectFeedback.objects.get().reply, "Lo probé y ya funciona")
        data.update(version=2, resolved=False)
        self.assertEqual(self.request(path, "patch", data, actor=self.owner).status_code, 200)

    def test_course_history_never_inferred_across_courses_or_from_legacy(self):
        Membership.objects.create(course=self.other_course, user=self.owner, role="alumno")
        self.save("Personal", automatic=False)
        self.link(); self.open(); old_revision = self.project["revision"]
        self.link(courseId=str(self.other_course.pk))
        teacher_b = self.login(self.outside)
        path = self.root()
        state = teacher_b.get(path + f"?course={self.other_course.pk}").json()
        self.assertEqual([v["revision"] for v in state["versions"]], [self.project["revision"]])
        for method in ["get", "post"]:
            self.assertEqual(getattr(teacher_b, method)(path + f"versions/{old_revision}/?course={self.other_course.pk}", {}, content_type="application/json").status_code, 404)
        self.assertEqual(self.request().status_code, 404)
        self.assertEqual(self.request("versions/1/", actor=self.owner, course=False).status_code, 200)

    def test_comment_prevents_reassignment_but_copy_has_no_comments_or_history(self):
        self.link(); self.open(); self.comment()
        Membership.objects.create(course=self.other_course, user=self.owner, role="alumno")
        for context in [None, str(self.other_course.pk)]:
            self.assertEqual(self.link(courseId=context).status_code, 400)
        data = {"id": str(uuid.uuid4()), "operationId": str(uuid.uuid4())}
        result = self.request("versions/2/copy/", "post", data)
        self.assertEqual(result.status_code, 201, result.content)
        new = Project.objects.get(pk=data["id"])
        self.assertEqual(new.owner, self.teacher)
        self.assertIsNone(new.course)
        self.assertEqual(new.provenance, {"title": EXAMPLES[0]["metadata"]["title"], "revision": 2, "course": self.course.name})
        self.assertFalse(new.history.exists())
        self.assertFalse(ProjectFeedback.objects.filter(snapshot__project=new).exists())
        self.assertEqual(self.request("versions/2/copy/", "post", data).status_code, 200)
        self.assertEqual(Project.objects.count(), 2)
        self.assertNotIn("provenance", new.document)

    def test_archived_is_read_only_for_teacher_and_owner(self):
        self.link(); self.open(); item = self.comment().json()["feedback"]
        self.course.is_archived = True; self.course.save()
        for actor in [self.owner, self.teacher]:
            state = self.request(actor=actor).json()
            self.assertFalse(state["canComment"]); self.assertFalse(state["canRespond"])
            self.assertEqual(len(state["feedback"]), 1)
        self.assertEqual(self.comment().status_code, 400)
        self.assertEqual(self.request(f"feedback/{item['id']}/", "patch", {}, actor=self.owner).status_code, 400)
        self.assertEqual(self.request("versions/2/").status_code, 200)
        self.assertEqual(self.request("versions/2/copy/", "post", {"id": str(uuid.uuid4()), "operationId": str(uuid.uuid4())}).status_code, 201)

    def test_membership_removal_revokes_all_teacher_endpoints(self):
        self.link(); self.open(); item = self.comment().json()["feedback"]
        for removed in [self.owner, self.teacher]:
            member = Membership.objects.get(user=removed, course=self.course); role = member.role; member.delete()
            for path, method in [("", "get"), ("versions/2/", "get"), ("versions/2/", "post"), ("feedback/", "post"), (f"feedback/{item['id']}/", "patch"), ("versions/2/copy/", "post")]:
                self.assertEqual(self.request(path, method).status_code, 404)
            self.assertTrue(Project.objects.filter(pk=self.project["id"]).exists())
            Membership.objects.create(user=removed, course=self.course, role=role)

    def test_deactivation_and_trash_revoke_then_reactivation_recovers(self):
        self.link(); self.open(); self.comment()
        self.owner.is_active = False; self.owner.save()
        self.assertEqual(self.request().status_code, 404)
        self.owner.is_active = True; self.owner.save()
        self.assertEqual(self.request().status_code, 200)
        p = Project.objects.get(); p.trashed_at = timezone.now(); p.save()
        self.assertEqual(self.request().status_code, 404)
        self.assertEqual(self.request(actor=self.owner).status_code, 200)
        self.teacher.is_active = False; self.teacher.save()
        self.assertEqual(self.request().status_code, 401)

    def test_feedback_boundaries_plain_text_quotas_and_atomic_failure(self):
        self.link(); self.open()
        for text in ["", " ", "x" * 1001, "\x00", "\ud800", 123]:
            self.assertEqual(self.comment(text).status_code, 400)
        html = '<script>alert("no ejecución")</script>\nCompará 1 < 2'
        self.assertEqual(self.comment(html).json()["feedback"]["text"], html)
        with patch("projects.review.MAX_FEEDBACK", 1):
            self.assertEqual(self.comment().status_code, 400)
        with patch("projects.review.MAX_FEEDBACK_BYTES", 1):
            self.assertEqual(self.comment().status_code, 400)
        self.assertEqual(ProjectFeedback.objects.count(), 1)
        self.save()
        with patch("projects.history.MAX_HISTORY_BYTES", 1):
            self.assertEqual(self.open().status_code, 400)
        self.assertFalse(ProjectRevision.objects.filter(revision=self.project["revision"]).exists())

    def test_csrf_account_precondition_methods_and_limits(self):
        self.link()
        client = Client(enforce_csrf_checks=True, HTTP_X_CAPI_ACCOUNT=str(self.teacher.pk)); client.force_login(self.teacher)
        self.assertEqual(client.post(self.root() + f"versions/2/?course={self.course.pk}", {}, content_type="application/json").status_code, 403)
        self.assertEqual(self.login(self.teacher).get(self.root(), HTTP_X_CAPI_ACCOUNT=str(self.owner.pk)).status_code, 409)
        self.assertEqual(Client().get(self.root()).status_code, 401)
        for method in ["put", "delete"]:
            self.assertEqual(self.request(method=method).status_code, 405)
        self.assertEqual(self.request("feedback/", "post", {"x": "x" * 16001}).status_code, 413)
        self.assertEqual(self.request("feedback/", "post", '{"id":"a","id":"b"}').status_code, 400)

    def test_purge_deletes_exact_feedback_after_deadline_not_other_project(self):
        self.link(); self.open(); self.comment()
        new = self.create()
        p = Project.objects.get(pk=self.project["id"]); p.trashed_at = timezone.now() - timedelta(days=31); p.save()
        result = self.client.post(self.url + "purge/", {"revision": p.revision, "operationId": str(uuid.uuid4()), "confirmation": p.title}, content_type="application/json")
        self.assertEqual(result.status_code, 200, result.content)
        self.assertFalse(ProjectFeedback.objects.exists()); self.assertFalse(ProjectRevision.objects.filter(project_id=p.pk).exists())
        self.assertTrue(Project.objects.filter(pk=new["id"]).exists())

    def test_teacher_baja_anonymizes_without_destroying_pupil_feedback(self):
        self.link(); self.open(); self.comment()
        Membership.objects.filter(user=self.teacher).delete()
        self.teacher.is_active = False; self.teacher.save()
        with self.assertRaises(ValidationError): self.teacher.delete()
        preview = summary(self.teacher)
        self.assertEqual(preview["interventionsAnonymized"], 1)
        admin = self.login(self.admin)
        result = admin.delete(f"/api/management/users/{self.teacher.pk}/deletion/", {"version": preview["version"], "confirmationAlias": self.teacher.username, "understandsLocalDrafts": True, "understandsPermanent": True, "backupReceipt": ""}, content_type="application/json")
        self.assertEqual(result.status_code, 200, result.content)
        self.assertIsNone(ProjectFeedback.objects.get().author_id)
        self.assertTrue(ProjectRevision.objects.get(revision=2).pinned)
        self.assertTrue(Project.objects.filter(pk=self.project["id"]).exists())

    def test_student_backup_contains_feedback_and_signature_tracks_changes(self):
        self.link(); self.open(); self.comment()
        before = summary(self.owner)["version"]
        self.teacher.display_name = "Profe nuevo"; self.teacher.save()
        self.assertNotEqual(summary(self.owner)["version"], before)
        Membership.objects.filter(user=self.owner).delete(); self.owner.is_active = False; self.owner.save()
        admin = self.login(self.admin); url = f"/api/management/users/{self.owner.pk}/deletion/"
        preview = summary(self.owner)
        self.assertEqual(preview["projects"]["feedbackCount"], 1)
        result = admin.post(url + "backup/", {"version": preview["version"], "confirmsPrivateBackup": True}, content_type="application/json")
        self.assertEqual(result.status_code, 200, getattr(result, "content", None))
        receipt = result["X-Capi-Backup-Receipt"]
        with zipfile.ZipFile(io.BytesIO(b"".join(result.streaming_content))) as archive:
            manifest = json.loads(archive.read("manifest.json"))
            self.assertEqual(manifest["schemaVersion"], 2)
            entry = manifest["projects"][0]
            comments = json.loads(archive.read(entry["feedback"]["file"]))
            self.assertEqual(comments[0]["revision"], 2)
            self.assertIn(2, [v["revision"] for v in entry["history"]])
        result = admin.delete(url, {"version": preview["version"], "confirmationAlias": self.owner.username, "understandsLocalDrafts": True, "understandsPermanent": True, "backupReceipt": receipt}, content_type="application/json")
        self.assertEqual(result.status_code, 200, result.content)
        self.assertFalse(ProjectFeedback.objects.exists())

    def test_student_in_both_courses_keeps_comments_and_snapshots_separate(self):
        Membership.objects.create(course=self.other_course, user=self.owner, role="alumno")
        self.link(); self.open(); self.comment("Sólo para el grupo A")
        second = self.create()
        self.client.post(f"/api/projects/{second['id']}/course/", {"revision": 1, "operationId": str(uuid.uuid4()), "courseId": str(self.other_course.pk)}, content_type="application/json")
        teacher_b = self.login(self.outside); root_b = self.root(second)
        teacher_b.post(root_b + f"versions/2/?course={self.other_course.pk}", {}, content_type="application/json")
        second_comment = teacher_b.post(root_b + f"feedback/?course={self.other_course.pk}", {"id": str(uuid.uuid4()), "revision": 2, "text": "Sólo para B"}, content_type="application/json")
        self.assertEqual(second_comment.status_code, 201, second_comment.content)
        self.assertEqual([f["text"] for f in self.request().json()["feedback"]], ["Sólo para el grupo A"])
        self.assertEqual([f["text"] for f in teacher_b.get(root_b + f"?course={self.other_course.pk}").json()["feedback"]], ["Sólo para B"])
        for suffix, method in [("", "get"), ("versions/2/", "get"), ("versions/2/copy/", "post"), ("feedback/", "post")]:
            for context in [self.course.pk, self.other_course.pk]:
                self.assertEqual(getattr(self.login(self.teacher), method)(root_b + suffix + f"?course={context}", {}, content_type="application/json").status_code, 404)

    def test_teacher_cannot_mutate_original_via_owner_endpoints(self):
        self.link(); self.open(); self.comment()
        client = self.login(self.teacher)
        for path, method in [("", "put"), ("rename/", "post"), ("trash/", "post"), ("restore/", "post"), ("course/", "post"), ("purge/", "post"), ("history/2/", "delete"), ("history/2/restore/", "post")]:
            data = {"revision": 2, "operationId": str(uuid.uuid4())}
            if not path: data["document"] = EXAMPLES[0]
            if path == "rename/": data["title"] = "No cambiar"
            if path == "course/": data["courseId"] = None
            if path == "purge/": data["confirmation"] = self.project["title"]
            if path == "history/2/": data["confirmation"] = "2"
            with self.subTest(path=path):
                self.assertEqual(getattr(client, method)(self.url + path, data, content_type="application/json").status_code, 404)
        self.assertEqual(Project.objects.get().revision, 2)

    def test_review_listing_student_filter_and_unknown_student_never_leak(self):
        self.link()
        teacher = self.login(self.teacher)
        self.assertEqual(teacher.get(self.shared + f"?student={self.owner.pk}").json()["count"], 1)
        for user in [self.peer, self.outside]:
            self.assertEqual(teacher.get(self.shared + f"?student={user.pk}").json()["count"], 0)
        self.assertEqual(teacher.get(self.shared + "?student=bad").status_code, 400)


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class SupervisionRaceTests(TransactionTestCase):
    setUp = ProjectCourseTests.setUp
    login = ProjectCourseTests.login
    create = ProjectCourseTests.create
    link = ProjectCourseTests.link
    root = SupervisionTests.root
    request = SupervisionTests.request
    open = SupervisionTests.open
    comment = SupervisionTests.comment
    save = SupervisionTests.save

    def parallel(self, *actions):
        barrier = Barrier(len(actions))
        def run(action):
            close_old_connections()
            try:
                barrier.wait(timeout=5)
                return action()
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=len(actions)) as pool:
            return list(pool.map(run, actions))

    def test_simultaneous_save_and_feedback_keep_exact_old_document(self):
        self.link(); self.open()
        owner_client = self.login(self.owner)
        sample = copy.deepcopy(EXAMPLES[0]); sample["metadata"]["title"] = "Guardado simultáneo"
        payload = {"revision": 2, "operationId": str(uuid.uuid4()), "document": sample}
        results = self.parallel(lambda: owner_client.put(self.url, payload, content_type="application/json"), lambda: self.comment(revision=2))
        self.assertEqual(sorted(response.status_code for response in results), [200, 201])
        self.assertEqual(Project.objects.get().revision, 3)
        item = ProjectFeedback.objects.get()
        self.assertEqual(item.snapshot.revision, 2)
        self.assertEqual(item.snapshot.document, EXAMPLES[0])
        self.assertTrue(item.snapshot.pinned)

    def test_simultaneous_membership_revocation_cannot_be_bypassed(self):
        self.link(); self.open()
        def revoke():
            with access_lock():
                Membership.objects.get(user=self.teacher, course=self.course).delete()
        _, result = self.parallel(revoke, lambda: self.comment(revision=2))
        self.assertIn(result.status_code, [201, 404])
        self.assertEqual(self.request().status_code, 404)
        self.assertEqual(ProjectFeedback.objects.count(), 1 if result.status_code == 201 else 0)

    def test_simultaneous_duplicate_comment_creates_only_one(self):
        self.link(); self.open()
        data = {"id": str(uuid.uuid4()), "revision": 2, "text": "Mismo mensaje"}
        results = self.parallel(lambda: self.request("feedback/", "post", data), lambda: self.request("feedback/", "post", data))
        self.assertEqual(sorted(response.status_code for response in results), [200, 201])
        self.assertEqual(ProjectFeedback.objects.count(), 1)
