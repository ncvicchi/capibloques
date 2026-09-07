import copy
import uuid

from django.test import Client, TestCase, override_settings

from accounts.models import User
from courses.models import Course, Membership
from projects.models import Project, ProjectEvent
from .test_accounts import FAST_HASHERS, PASSWORD
from .test_projects import EXAMPLES


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class ProjectCourseTests(TestCase):
    def setUp(self):
        def user(alias, **roles):
            return User.objects.create_user(alias, display_name=alias, password=PASSWORD, must_change_password=False, **roles)
        self.owner = user("luna")
        self.peer = user("sol")
        self.teacher = user("profe", is_teacher=True, is_student=False)
        self.outside = user("otro", is_teacher=True, is_student=False)
        self.admin = user("admin", is_administrator=True, is_student=False)
        self.course = Course.objects.create(name="Robótica A")
        self.other_course = Course.objects.create(name="Robótica B")
        for person, role in [(self.owner, "alumno"), (self.peer, "alumno"), (self.teacher, "docente")]:
            Membership.objects.create(course=self.course, user=person, role=role)
        Membership.objects.create(course=self.other_course, user=self.outside, role="docente")
        self.client = self.login(self.owner)
        self.project = self.create()
        self.url = f"/api/projects/{self.project['id']}/"
        self.shared = f"/api/courses/{self.course.pk}/projects/"

    def login(self, actor):
        client = Client(HTTP_X_CAPI_ACCOUNT=str(actor.pk)); client.force_login(actor)
        return client

    def create(self):
        response = self.client.post("/api/projects/", {"id": str(uuid.uuid4()), "operationId": str(uuid.uuid4()), "document": copy.deepcopy(EXAMPLES[0])}, content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["project"]

    def link(self, course=True, **changes):
        payload = {"revision": self.project["revision"], "operationId": str(uuid.uuid4()), "courseId": str(self.course.pk) if course else None, **changes}
        response = self.client.post(self.url + "course/", payload, content_type="application/json")
        if response.status_code == 200:
            self.project = response.json()["project"]
        return response

    def test_personal_default_eligible_courses_and_portable_json(self):
        self.assertIsNone(self.project["course"])
        self.assertEqual(self.client.get("/api/projects/courses/").json()["courses"], [{"id": str(self.course.pk), "name": self.course.name}])
        self.assertEqual(self.login(self.teacher).get("/api/projects/courses/").json()["courses"], [])
        self.assertEqual(self.link().status_code, 200)
        self.assertEqual(self.client.get(self.url).json()["document"], EXAMPLES[0])
        self.assertNotIn("document", self.client.get(self.url + "?metadata=1").json())
        self.assertTrue(self.project["course"]["ownerCanEdit"])

    def test_course_link_replay_revision_and_action_binding(self):
        operation = str(uuid.uuid4())
        first = self.link(operationId=operation)
        again = self.link(operationId=operation, revision=1)
        self.assertEqual(first.json(), again.json())
        self.assertEqual(self.link(False, operationId=operation, revision=1).status_code, 409)
        self.assertEqual(self.link(False, revision=1).status_code, 409)
        self.assertEqual(ProjectEvent.objects.count(), 2)
        self.assertEqual(self.link(False).status_code, 200)
        self.assertIsNone(self.project["course"])

    def test_link_requires_own_project_and_active_student_membership(self):
        self.assertEqual(self.link(courseId=str(self.other_course.pk)).status_code, 404)
        self.course.is_archived = True; self.course.save()
        self.assertEqual(self.link().status_code, 404)
        for actor in [self.peer, self.teacher, self.admin]:
            self.assertEqual(self.login(actor).post(self.url + "course/", {}, content_type="application/json").status_code, 404)
        self.assertIsNone(Project.objects.get().course)

    def test_only_assigned_teacher_reads_explicit_shared_projects(self):
        teacher = self.login(self.teacher)
        self.assertEqual(teacher.get(self.shared).json()["count"], 0)
        self.link()
        self.create()  # Personal, no se comparte por estar inscripto.
        listing = teacher.get(self.shared).json()
        self.assertEqual(listing["count"], 1)
        self.assertEqual(listing["projects"][0]["owner"]["alias"], "luna")
        self.assertNotIn("document", listing["projects"][0])
        self.assertEqual(teacher.get(self.shared + self.project["id"] + "/").json()["document"], EXAMPLES[0])
        for actor in [self.owner, self.peer, self.outside, self.admin]:
            client = self.login(actor)
            for path in [self.shared, self.shared + self.project["id"] + "/"]:
                self.assertEqual(client.get(path).status_code, 404)
        # Ni siquiera el docente puede usar las rutas privadas del propietario.
        self.assertEqual(teacher.get(self.url).status_code, 404)
        for method in ["post", "put", "delete"]:
            self.assertEqual(getattr(teacher, method)(self.shared + self.project["id"] + "/", {}, content_type="application/json").status_code, 405)

    def test_archived_or_removed_student_preserves_original_and_allows_personal_copy(self):
        self.link()
        for removed in [False, True]:
            if removed:
                self.course.is_archived = False; self.course.save()
                Membership.objects.filter(course=self.course, user=self.owner).delete()
            else:
                self.course.is_archived = True; self.course.save()
            current = self.client.get(self.url).json()
            self.assertFalse(current["project"]["course"]["ownerCanEdit"])
            payload = {"revision": self.project["revision"], "operationId": str(uuid.uuid4()), "document": EXAMPLES[0]}
            self.assertEqual(self.client.put(self.url, payload, content_type="application/json").json()["code"], "course_locked")
            payload.pop("document"); payload["title"] = "No cambiar"
            self.assertEqual(self.client.post(self.url + "rename/", payload, content_type="application/json").json()["code"], "course_locked")
            self.assertEqual(self.link(False).json()["code"], "course_locked")
            self.assertIsNone(self.create()["course"])
            self.assertEqual(self.login(self.teacher).get(self.shared).json()["count"], 0 if removed else 1)

    def test_revocation_deactivation_and_trash_remove_teacher_access(self):
        self.link(); teacher = self.login(self.teacher)
        path = self.shared + self.project["id"] + "/"
        self.owner.is_active = False; self.owner.save()
        self.assertEqual(teacher.get(path).status_code, 404)
        self.owner.is_active = True; self.owner.save()
        self.client = self.login(self.owner)
        self.assertEqual(teacher.get(path).status_code, 200)
        data = {"revision": 2, "operationId": str(uuid.uuid4())}
        trashed = self.client.post(self.url + "trash/", data, content_type="application/json")
        self.assertEqual(trashed.status_code, 200)
        self.assertEqual(teacher.get(path).status_code, 404)
        Membership.objects.filter(course=self.course, user=self.teacher).delete()
        self.assertEqual(teacher.get(self.shared).status_code, 404)

    def test_admin_teacher_must_also_be_assigned_and_filters_validate(self):
        self.link()
        self.admin.is_teacher = True; self.admin.save()
        admin = self.login(self.admin)
        self.assertEqual(admin.get(self.shared).status_code, 404)
        Membership.objects.create(course=self.course, user=self.admin, role="docente")
        self.assertEqual(admin.get(self.shared).json()["count"], 1)
        self.assertEqual(admin.get(self.shared + "?q=NoExiste").json()["count"], 0)
        for query in ["page=0", "page=no", "q=" + "x" * 81]:
            self.assertEqual(admin.get(self.shared + "?" + query).status_code, 400)

    def test_link_csrf_and_account_precondition(self):
        client = Client(enforce_csrf_checks=True, HTTP_X_CAPI_ACCOUNT=str(self.owner.pk)); client.force_login(self.owner)
        self.assertEqual(client.post(self.url + "course/", {}, content_type="application/json").status_code, 403)
        self.assertEqual(self.client.get(self.shared, HTTP_X_CAPI_ACCOUNT=str(self.peer.pk)).status_code, 409)
        self.assertEqual(Client().get(self.shared).status_code, 401)

    def test_student_in_two_courses_does_not_share_across_teachers(self):
        Membership.objects.create(course=self.other_course, user=self.owner, role="alumno")
        self.link()
        second = self.create()
        response = self.client.post(f"/api/projects/{second['id']}/course/", {"revision": 1, "operationId": str(uuid.uuid4()), "courseId": str(self.other_course.pk)}, content_type="application/json")
        self.assertEqual(response.status_code, 200)
        for actor, course, visible, hidden in [(self.teacher, self.course, self.project, second), (self.outside, self.other_course, second, self.project)]:
            client = self.login(actor); path = f"/api/courses/{course.pk}/projects/"
            self.assertEqual([item["id"] for item in client.get(path).json()["projects"]], [visible["id"]])
            self.assertEqual(client.get(path + hidden["id"] + "/").status_code, 404)
