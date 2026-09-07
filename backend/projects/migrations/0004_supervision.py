import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("projects", "0003_history_and_deletions"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name="project", name="provenance", field=models.JSONField(null=True)),
        migrations.AddField(model_name="projectrevision", name="course", field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="project_versions", to="courses.course")),
        migrations.CreateModel(name="ProjectFeedback", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("text", models.TextField()), ("reply", models.TextField(blank=True)),
            ("resolved", models.BooleanField(default=False)), ("version", models.PositiveIntegerField(default=1)),
            ("size_bytes", models.PositiveIntegerField()),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("creation_digest", models.CharField(max_length=64)),
            ("last_operation", models.UUIDField(null=True)), ("last_digest", models.CharField(blank=True, max_length=64)),
            ("author", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="project_feedback", to=settings.AUTH_USER_MODEL)),
            ("snapshot", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="feedback", to="projects.projectrevision")),
        ], options={"ordering": ["created_at", "id"]}),
    ]
