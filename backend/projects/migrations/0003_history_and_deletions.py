import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("projects", "0002_project_course")]
    operations = [
        migrations.AddField(model_name="project", name="history_checkpoint", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="project", name="history_kind", field=models.CharField(default="manual", max_length=20)),
        migrations.AddField(model_name="project", name="last_checkpoint_at", field=models.DateTimeField(default=django.utils.timezone.now)),
        migrations.CreateModel(name="ProjectRevision", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("revision", models.PositiveIntegerField()), ("document", models.JSONField()),
            ("size_bytes", models.PositiveIntegerField()), ("title", models.CharField(max_length=80)),
            ("kind", models.CharField(max_length=20)), ("created_at", models.DateTimeField()),
            ("pinned", models.BooleanField(default=False)),
            ("project", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="history", to="projects.project")),
        ], options={"ordering": ["-revision"], "constraints": [models.UniqueConstraint(fields=("project", "revision"), name="project_revision_unique")]}),
        migrations.CreateModel(name="ProjectDeletion", fields=[
            ("id", models.UUIDField(editable=False, primary_key=True, serialize=False)),
            ("owner_id_snapshot", models.UUIDField()), ("operation", models.UUIDField()),
            ("digest", models.CharField(max_length=64)), ("deleted_at", models.DateTimeField(auto_now_add=True)),
        ]),
    ]
