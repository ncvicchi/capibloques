import re
import uuid
from contextlib import contextmanager

from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.core.exceptions import ValidationError
from django.db import connection, models, transaction
from django.db.models.functions import Lower
from django.utils.crypto import salted_hmac


def normalize_alias(value):
    value = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]{2,31}", value):
        raise ValidationError("Usá entre 3 y 32 letras sin acentos, números, puntos, guiones o guiones bajos.")
    return value


@contextmanager
def access_lock():
    # PostgreSQL: serializa bootstrap, revocaciones y protección del último admin.
    # Usar esta transacción también en el futuro ABM; no modificar acceso en bulk.
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(129710, 1)")
        yield


class UserManager(DjangoUserManager):
    def get_by_natural_key(self, username):
        return self.get(username=normalize_alias(username))

    def _create_user(self, username, email, password, **extra_fields):
        user = self.model(username=normalize_alias(username), **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.update(is_administrator=True, is_student=False)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=32, unique=True)
    email = None
    first_name = None
    last_name = None
    display_name = models.CharField(max_length=80)
    is_administrator = models.BooleanField(default=False)
    is_teacher = models.BooleanField(default=False)
    is_student = models.BooleanField(default=True)
    must_change_password = models.BooleanField(default=True)
    session_epoch = models.PositiveIntegerField(default=1, editable=False)
    objects = UserManager()
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        constraints = [
            models.UniqueConstraint(Lower("username"), name="unique_alias_ignore_case"),
            models.CheckConstraint(condition=models.Q(username=Lower("username")), name="alias_stored_lowercase"),
            models.CheckConstraint(
                condition=(models.Q(is_student=True, is_administrator=False, is_teacher=False)
                           | (models.Q(is_student=False) & (models.Q(is_administrator=True) | models.Q(is_teacher=True)))),
                name="valid_user_roles",
            ),
        ]

    @property
    def roles(self):
        return [name for name, enabled in (("administrador", self.is_administrator), ("docente", self.is_teacher), ("alumno", self.is_student)) if enabled]

    def _get_session_auth_hash(self, secret=None):
        return salted_hmac("capibloques.account.session", f"{self.password}:{self.session_epoch}", secret=secret, algorithm="sha256").hexdigest()

    def clean(self):
        self.username = normalize_alias(self.username)
        self.display_name = self.display_name.strip()
        if not self.display_name or len(self.display_name) > 80:
            raise ValidationError("El nombre visible debe tener entre 1 y 80 caracteres.")

    def save(self, *args, **kwargs):
        if kwargs.get("update_fields") == ["last_login"]:
            return super().save(*args, **kwargs)
        self.clean()
        with access_lock():
            previous = type(self).objects.filter(pk=self.pk).first()
            fields = {"password", "is_active", "is_administrator", "is_teacher", "is_student", "is_staff", "is_superuser", "must_change_password", "username"}
            written = set(kwargs.get("update_fields") or fields)
            if previous:
                # Retirar explícitamente las asignaciones incompatibles antes de
                # cambiar de rol, también en cursos archivados. Nunca cascadas.
                teacher = self.is_teacher if "is_teacher" in written else previous.is_teacher
                student = self.is_student if "is_student" in written else previous.is_student
                if ((not teacher and previous.is_teacher and self.course_memberships.filter(role="docente").exists())
                        or (not student and previous.is_student and self.course_memberships.filter(role="alumno").exists())):
                    raise ValidationError("Retirá primero sus asignaciones de cursos (incluidos los archivados) antes de cambiar ese rol.")
                active = self.is_active if "is_active" in written else previous.is_active
                admin = self.is_administrator if "is_administrator" in written else previous.is_administrator
                if previous.is_active and previous.is_administrator and not (active and admin):
                    self._require_other_admin()
                if any(getattr(previous, field) != getattr(self, field) for field in fields & written):
                    self.session_epoch = previous.session_epoch + 1
                    if kwargs.get("update_fields") is not None:
                        kwargs["update_fields"] = set(kwargs["update_fields"]) | {"session_epoch"}
                else:
                    self.session_epoch = max(previous.session_epoch, self.session_epoch)
            return super().save(*args, **kwargs)

    def _require_other_admin(self):
        if not type(self).objects.filter(is_administrator=True, is_active=True).exclude(pk=self.pk).exists():
            raise ValidationError("Debe quedar al menos un administrador activo.")

    def delete(self, *args, **kwargs):
        with access_lock():
            current = type(self).objects.get(pk=self.pk)
            if current.projects.exists():
                raise ValidationError("Esta cuenta tiene proyectos en servidor, incluida su papelera. La eliminación con respaldo se habilitará en la siguiente subfase. Por ahora podés desactivarla sin perder sus proyectos.")
            if current.course_memberships.exists():
                raise ValidationError("Esta cuenta pertenece a cursos. Retirá primero sus membresías en Gestionar cursos, incluidos los archivados, o desactivá la cuenta.")
            if current.is_administrator and current.is_active:
                current._require_other_admin()
            return super().delete(*args, **kwargs)


class LoginBucket(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    started_at = models.DateTimeField(db_index=True)
    attempts = models.PositiveIntegerField(default=0)


class AccessEvent(models.Model):
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class ManagementEvent(models.Model):
    actor = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="management_actions")
    actor_id_snapshot = models.UUIDField()
    target_id_snapshot = models.UUIDField()
    action = models.CharField(max_length=32)
    changed_fields = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
