import uuid

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower


class Course(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=500, blank=True)
    is_archived = models.BooleanField(default=False)
    version = models.UUIDField(default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(Lower("name"), name="unique_course_name_ignore_case")]


class Membership(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="memberships")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="course_memberships")
    role = models.CharField(max_length=7, choices=[("docente", "Docente"), ("alumno", "Alumno")])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["course", "user"], name="unique_course_user"),
            models.CheckConstraint(condition=models.Q(role__in=["docente", "alumno"]), name="valid_membership_role"),
        ]


class CourseEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    actor_id_snapshot = models.UUIDField()
    course_id_snapshot = models.UUIDField()
    action = models.CharField(max_length=32)
    changed_fields = models.JSONField(default=list)
    added_members = models.JSONField(default=list)
    removed_members = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
