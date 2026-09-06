import uuid
import django.db.models.deletion
import django.db.models.functions.text
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="Course",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=100)),
                ("description", models.CharField(blank=True, max_length=500)),
                ("is_archived", models.BooleanField(default=False)),
                ("version", models.UUIDField(default=uuid.uuid4, editable=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"constraints": [models.UniqueConstraint(django.db.models.functions.text.Lower("name"), name="unique_course_name_ignore_case")]},
        ),
        migrations.CreateModel(
            name="CourseEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id_snapshot", models.UUIDField()),
                ("course_id_snapshot", models.UUIDField()),
                ("action", models.CharField(max_length=32)),
                ("changed_fields", models.JSONField(default=list)),
                ("added_members", models.JSONField(default=list)),
                ("removed_members", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Membership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("docente", "Docente"), ("alumno", "Alumno")], max_length=7)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("course", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="memberships", to="courses.course")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="course_memberships", to=settings.AUTH_USER_MODEL)),
            ],
            options={"constraints": [
                models.UniqueConstraint(fields=("course", "user"), name="unique_course_user"),
                models.CheckConstraint(condition=models.Q(("role__in", ["docente", "alumno"])), name="valid_membership_role"),
            ]},
        ),
    ]
