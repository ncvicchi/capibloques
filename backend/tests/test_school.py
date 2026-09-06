from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from PIL import Image, PngImagePlugin

from accounts.models import User
from school.models import School, SchoolEvent
from school.middleware import MAX_UPLOAD, SchoolUploadLimit
from .test_accounts import FAST_HASHERS, PASSWORD


def picture(format="PNG", size=(64, 32), **options):
    result = BytesIO()
    Image.new("RGB", size, (40, 100, 170)).save(result, format=format, **options)
    return result.getvalue()


def upload(raw=None, mime="image/png"):
    return SimpleUploadedFile("logo.png", picture() if raw is None else raw, content_type=mime)


@override_settings(PASSWORD_HASHERS=FAST_HASHERS)
class SchoolTests(TestCase):
    root = "/api/management/school/"

    def setUp(self):
        self.admin = User.objects.create_user("admin", password=PASSWORD, display_name="Admin", is_administrator=True, is_student=False, must_change_password=False)
        self.client.force_login(self.admin)

    def save_school(self, **changes):
        school = School.objects.first()
        return self.client.post(self.root, {"name": "Colegio de prueba", "version": str(school.version) if school else "unconfigured", "logoAction": "keep", **changes})

    def test_public_endpoint_is_minimal_and_does_not_create_settings(self):
        response = Client().get("/api/school/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"name": "", "logoUrl": None})
        self.assertIn("no-store", response["Cache-Control"])
        self.assertFalse(School.objects.exists())
        self.assertEqual(Client().get("/api/school/logo/" + "0" * 64 + "/").status_code, 404)

    def test_only_definitive_administrator_can_read_or_write_settings(self):
        for role in (None, "student", "teacher"):
            client = Client()
            if role:
                user = User.objects.create_user(role, password=PASSWORD, display_name=role, is_student=role == "student", is_teacher=role == "teacher", must_change_password=False)
                client.force_login(user)
            for method in ("get", "post"):
                response = client.get(self.root) if method == "get" else client.post(self.root, {"name": "Colegio", "version": "unconfigured", "logoAction": "keep"})
                self.assertEqual(response.status_code, 403 if role else 401)
        self.admin.must_change_password = True
        self.admin.save(update_fields=["must_change_password"])
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get(self.root).status_code, 403)
        self.assertEqual(self.save_school().status_code, 403)
        self.assertFalse(School.objects.exists())

    def test_name_without_logo_and_audit_are_persistent(self):
        response = self.save_school(name="  Escuela del Río  ")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Client().get("/api/school/").json(), {"name": "Escuela del Río", "logoUrl": None})
        self.assertEqual(School.objects.get(pk=1).name, "Escuela del Río")
        event = SchoolEvent.objects.get()
        self.assertEqual(event.actor_id_snapshot, self.admin.pk)
        self.assertEqual(event.changed_fields, ["name"])
        self.assertEqual(set(response.json()), {"school", "version", "actor", "csrfToken"})

    def test_png_jpeg_webp_reencoded_and_public_without_auth(self):
        for format, mime in [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")]:
            response = self.save_school(logoAction="replace", logo=upload(picture(format), mime))
            self.assertEqual(response.status_code, 200)
            data = Client().get("/api/school/").json()
            self.assertEqual(set(data), {"name", "logoUrl"})
            public_logo = Client().get(data["logoUrl"])
            self.assertEqual(public_logo.status_code, 200)
            self.assertEqual(public_logo["Content-Type"], "image/png")
            self.assertEqual(public_logo["X-Content-Type-Options"], "nosniff")
            self.assertIn("sandbox", public_logo["Content-Security-Policy"])
            with Image.open(BytesIO(public_logo.content)) as image:
                self.assertEqual(image.format, "PNG")
                self.assertEqual(image.size, (64, 32))
            self.assertEqual(bytes(School.objects.get(pk=1).logo), public_logo.content)

    def test_resize_preserves_ratio_and_strips_metadata_and_trailing_content(self):
        info = PngImagePlugin.PngInfo()
        info.add_text("Author", "PRIVATE-METADATA")
        self.assertEqual(self.save_school(logoAction="replace", logo=upload(picture(size=(1200, 600), pnginfo=info) + b"PRIVATE-TRAILER")).status_code, 200)
        raw = bytes(School.objects.get().logo)
        self.assertNotIn(b"PRIVATE", raw)
        with Image.open(BytesIO(raw)) as image:
            self.assertEqual(image.size, (512, 256))
            self.assertEqual(image.info, {})

    def test_jpeg_orientation_applied_without_retaining_exif(self):
        exif = Image.Exif()
        exif[274] = 6
        self.save_school(logoAction="replace", logo=upload(picture("JPEG", (100, 50), exif=exif), "image/jpeg"))
        with Image.open(BytesIO(bytes(School.objects.get().logo))) as image:
            self.assertEqual(image.size, (50, 100))
            self.assertFalse(image.getexif())

    def test_bad_upload_does_not_replace_existing_name_logo_version_or_audit(self):
        self.save_school(logoAction="replace", logo=upload())
        before = School.objects.get()
        for raw, mime in [(b"<svg><script>alert(1)</script></svg>", "image/png"), (picture("JPEG"), "image/png"), (picture()[:30], "image/png"), (picture("GIF"), "image/gif"), (b"", "image/png")]:
            self.assertEqual(self.save_school(name="NO GUARDAR", logoAction="replace", logo=upload(raw, mime)).status_code, 400)
            after = School.objects.get()
            self.assertEqual((after.name, bytes(after.logo), after.version), (before.name, bytes(before.logo), before.version))
        self.assertEqual(SchoolEvent.objects.count(), 1)

    def test_dimensions_and_animation_rejected(self):
        for size in ((2049, 1), (2048, 2000)):
            self.assertEqual(self.save_school(logoAction="replace", logo=upload(picture(size=size))).status_code, 400)
        result = BytesIO()
        Image.new("RGB", (8, 8), "red").save(result, format="PNG", save_all=True, append_images=[Image.new("RGB", (8, 8), "blue")], duration=100, loop=0)
        self.assertEqual(self.save_school(logoAction="replace", logo=upload(result.getvalue())).status_code, 400)
        self.assertFalse(School.objects.exists())

    def test_total_upload_limit_runs_before_image_decoder_and_csrf_parser(self):
        with patch("school.views.normalize_logo") as decode:
            response = self.save_school(logoAction="replace", logo=upload(b"x" * (MAX_UPLOAD + 20_000)))
            self.assertEqual(response.status_code, 413)
            decode.assert_not_called()
        from django.test import RequestFactory
        for length in ("", "-1", "bad", str(MAX_UPLOAD + 16_385)):
            request = RequestFactory().post(self.root, CONTENT_LENGTH=length)
            handler = SchoolUploadLimit(lambda request: self.fail("No debe alcanzar el parser"))
            self.assertEqual(handler(request).status_code, 413)

    def test_strict_fields_actions_and_name_validation(self):
        for changes in ({"name": " "}, {"name": "a" * 101}, {"name": "Nombre\nOtro"}, {"version": "v" * 41}, {"logoAction": "download"}, {"logoAction": "replace"}, {"logo": upload()}, {"is_administrator": True}, {"name": ["uno", "dos"]}):
            self.assertEqual(self.save_school(**changes).status_code, 400)
        self.assertFalse(School.objects.exists())

    def test_keep_remove_and_obsolete_logo_url(self):
        first = self.save_school(logoAction="replace", logo=upload()).json()
        old_url = first["school"]["logoUrl"]
        self.assertEqual(self.save_school(name="Nuevo nombre").json()["school"]["logoUrl"], old_url)
        second = self.save_school(logoAction="replace", logo=upload(picture(size=(80, 20)))).json()
        self.assertNotEqual(second["school"]["logoUrl"], old_url)
        self.assertEqual(Client().get(old_url).status_code, 404)
        self.assertIsNone(self.save_school(logoAction="remove").json()["school"]["logoUrl"])
        self.assertEqual(bytes(School.objects.get().logo), b"")
        self.assertEqual(Client().get(second["school"]["logoUrl"]).status_code, 404)

    def test_stale_version_cannot_overwrite_or_remove_logo(self):
        initial = self.save_school(logoAction="replace", logo=upload()).json()
        self.save_school(name="Actualizado")
        response = self.save_school(version=initial["version"], name="Viejo", logoAction="remove")
        self.assertEqual(response.status_code, 409)
        school = School.objects.get()
        self.assertEqual(school.name, "Actualizado")
        self.assertTrue(school.logo)
        self.assertEqual(SchoolEvent.objects.count(), 2)

    def test_revocation_during_image_validation_is_checked_before_write(self):
        def revoked(upload):
            self.admin.must_change_password = True
            self.admin.save(update_fields=["must_change_password"])
            return picture()
        with patch("school.views.normalize_logo", side_effect=revoked):
            self.assertEqual(self.save_school(logoAction="replace", logo=upload()).status_code, 401)
        self.assertFalse(School.objects.exists())

    def test_csrf_required_and_setting_does_not_revoke_administrator(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.admin)
        data = client.get(self.root).json()
        body = {"name": "Colegio", "version": data["version"], "logoAction": "replace"}
        self.assertEqual(client.post(self.root, {**body, "logo": upload()}).status_code, 403)
        self.assertEqual(client.post(self.root, {**body, "logo": upload()}, HTTP_X_CSRFTOKEN=data["csrfToken"]).status_code, 200)
        self.assertEqual(client.get(self.root).status_code, 200)
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.session_epoch, 1)

    def test_noop_does_not_add_audit_and_deleting_actor_preserves_school(self):
        first = self.save_school().json()
        self.assertEqual(self.save_school().json()["version"], first["version"])
        self.assertEqual(SchoolEvent.objects.count(), 1)
        User.objects.create_user("backup", password=PASSWORD, display_name="Otro admin", is_administrator=True, is_student=False)
        actor_id = self.admin.pk
        self.admin.delete()
        self.assertEqual(School.objects.count(), 1)
        event = SchoolEvent.objects.get()
        self.assertIsNone(event.actor_id)
        self.assertEqual(event.actor_id_snapshot, actor_id)
