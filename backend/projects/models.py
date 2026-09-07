import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="projects")
    course = models.ForeignKey("courses.Course", null=True, on_delete=models.PROTECT, related_name="projects")
    title = models.CharField(max_length=80)
    document = models.JSONField()
    size_bytes = models.PositiveIntegerField()
    revision = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    trashed_at = models.DateTimeField(null=True)
    last_operation = models.UUIDField()
    last_digest = models.CharField(max_length=64)
    history_checkpoint = models.BooleanField(default=True)
    history_kind = models.CharField(max_length=20, default="manual")
    last_checkpoint_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [models.Index(fields=["owner", "trashed_at", "-updated_at"], name="project_owner_listing")]


class ProjectEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    actor_id_snapshot = models.UUIDField()
    project_id_snapshot = models.UUIDField()
    revision = models.PositiveIntegerField()
    action = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class ProjectRevision(models.Model):
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name="history")
    revision = models.PositiveIntegerField()
    document = models.JSONField()
    size_bytes = models.PositiveIntegerField()
    title = models.CharField(max_length=80)
    kind = models.CharField(max_length=20)
    created_at = models.DateTimeField()
    # Fase 5 debe fijar la revisión antes de referenciarla en una devolución.
    pinned = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "revision"], name="project_revision_unique")]
        ordering = ["-revision"]


class ProjectDeletion(models.Model):
    # Sin contenido. Impide recrear un UUID purgado con un POST antiguo.
    id = models.UUIDField(primary_key=True, editable=False)
    owner_id_snapshot = models.UUIDField()
    operation = models.UUIDField()
    digest = models.CharField(max_length=64)
    deleted_at = models.DateTimeField(auto_now_add=True)
