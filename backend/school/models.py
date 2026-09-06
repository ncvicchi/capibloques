import uuid

from django.conf import settings
from django.db import models


class School(models.Model):
    # Una institución por instalación; el logo pequeño forma parte del backup PG.
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    name = models.CharField(max_length=100)
    logo = models.BinaryField(default=bytes, editable=False)
    logo_digest = models.CharField(max_length=64, blank=True)
    version = models.UUIDField(default=uuid.uuid4, editable=False)

    class Meta:
        constraints = [models.CheckConstraint(condition=models.Q(id=1), name="school_singleton")]


class SchoolEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    actor_id_snapshot = models.UUIDField()
    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

