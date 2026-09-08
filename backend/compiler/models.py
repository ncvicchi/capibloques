import uuid
from django.db import models
from django.utils import timezone


class CompilerConfig(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    concurrency = models.PositiveSmallIntegerField(default=1)
    ceiling = models.PositiveSmallIntegerField(default=1)
    paused = models.BooleanField(default=True)
    revision = models.PositiveIntegerField(default=1)
    recipe = models.CharField(max_length=64, blank=True)
    runner_seen = models.DateTimeField(null=True)


class Build(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Explicit lifecycle in retire_project; no hidden cascade at account deletion.
    # UUIDs alone confer no access: every read/claim checks the live owner/project.
    owner_id_snapshot = models.UUIDField(db_index=True)
    project_id_snapshot = models.UUIDField(db_index=True)
    project_revision = models.PositiveIntegerField()
    title = models.CharField(max_length=80)
    framework = models.CharField(max_length=10)
    recipe = models.CharField(max_length=64)
    request_digest = models.CharField(max_length=64)
    cache_key = models.CharField(max_length=64)
    document = models.JSONField(null=True)
    wifi_encrypted = models.TextField(blank=True)
    contains_wifi = models.BooleanField(default=False)
    state = models.CharField(max_length=12, default="queued", db_index=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    started_at = models.DateTimeField(null=True)
    finished_at = models.DateTimeField(null=True)
    expires_at = models.DateTimeField()
    attempt = models.UUIDField(null=True)
    lease_until = models.DateTimeField(null=True)
    cancel_requested = models.BooleanField(default=False)
    artifact = models.UUIDField(null=True)
    artifact_sha256 = models.CharField(max_length=64, blank=True)
    artifact_bytes = models.PositiveIntegerField(default=0)
    message = models.CharField(max_length=200, blank=True)
    metrics = models.JSONField(default=dict)

    class Meta:
        indexes = [models.Index(fields=["state", "created_at"], name="build_queue_order")]


class CompilerEvent(models.Model):
    actor_id_snapshot = models.UUIDField(null=True)
    before = models.JSONField()
    after = models.JSONField()
    created_at = models.DateTimeField(default=timezone.now)
