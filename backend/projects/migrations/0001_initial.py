import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("title", models.CharField(max_length=80)),
                ("document", models.JSONField()),
                ("size_bytes", models.PositiveIntegerField()),
                ("revision", models.PositiveIntegerField(default=1)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("trashed_at", models.DateTimeField(null=True)),
                ("last_operation", models.UUIDField()),
                ("last_digest", models.CharField(max_length=64)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="projects", to=settings.AUTH_USER_MODEL)),
            ],
            options={"indexes": [models.Index(fields=["owner", "trashed_at", "-updated_at"], name="project_owner_listing")]},
        ),
        migrations.CreateModel(
            name="ProjectEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id_snapshot", models.UUIDField()),
                ("project_id_snapshot", models.UUIDField()),
                ("revision", models.PositiveIntegerField()),
                ("action", models.CharField(max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
