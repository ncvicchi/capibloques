"""All transitions under access_lock. Expired leases NEVER free capacity.

Only the trusted host runner may acknowledge termination of an attempt. Public
HTTP cannot finish, reclaim or select a compiler image. Content is short-lived.
"""
import base64
import hashlib
import json
import uuid
from datetime import timedelta
from pathlib import Path

from cryptography.fernet import Fernet
from django.conf import settings
from django.utils import timezone
from django.utils.crypto import salted_hmac

from accounts.models import access_lock
from projects.models import Project
from projects.validation import require
from projects.views import owner_can_edit
from .models import Build, CompilerConfig

MAX_ARTIFACT = 5_000_000
ACTIVE = ("queued", "building")


def config():
    return CompilerConfig.objects.get_or_create(pk=1)[0]


def cipher():
    key = salted_hmac("capi.compiler.wifi.v1", "encryption", algorithm="sha256").digest()
    return Fernet(base64.urlsafe_b64encode(key))


def wifi_value(value):
    if value is None:
        return None
    require(isinstance(value, dict) and set(value) == {"ssid", "password", "consent"})
    require(value["consent"] is True, "Confirmá el envío temporal de la clave al servidor.")
    ssid, password = value["ssid"], value["password"]
    require(isinstance(ssid, str) and isinstance(password, str))
    try:
        valid_ssid = 1 <= len(ssid.encode("utf-8")) <= 32
        valid_password = password == "" or (8 <= len(password) <= 63 and all(32 <= ord(c) <= 126 for c in password))
        require(valid_ssid and valid_password and all(ord(c) >= 32 and ord(c) != 127 for c in ssid), "Revisá Wi-Fi: nombre de 1–32 bytes y clave WPA2 de 8–63 caracteres ASCII, o vacía para una red abierta.")
    except UnicodeError:
        require(False, "El nombre de la red no es válido.")
    return {"ssid": ssid, "password": password}


def live_project(job):
    project = Project.objects.select_related("owner", "course").filter(pk=job.project_id_snapshot, owner_id=job.owner_id_snapshot, owner__is_active=True, trashed_at__isnull=True).first()
    return project if project and owner_can_edit(project) else None


def forget(job, state, message):
    job.state, job.message = state, message
    job.document, job.wifi_encrypted, job.artifact = None, "", None
    job.artifact_bytes, job.artifact_sha256 = 0, ""
    job.finished_at = timezone.now()
    job.save()


def retire_project_builds(project):
    # Caller owns access_lock. Active attempts keep their slot until confirmed dead.
    for job in Build.objects.filter(project_id_snapshot=project.pk):
        job.title, job.document, job.wifi_encrypted = "", None, ""
        job.artifact, job.artifact_bytes, job.artifact_sha256 = None, 0, ""
        if job.state == "building":
            job.cancel_requested = True
            job.save()
        else:
            forget(job, "cancelled", "El proyecto fue eliminado.")


def sweep(now=None):
    now = now or timezone.now()
    for job in Build.objects.exclude(state="building").filter(expires_at__lte=now).exclude(state__in=["expired", "cancelled", "failed"]):
        forget(job, "expired", "El pedido o el firmware venció. Podés compilar nuevamente.")
    # Metadata/idempotency window: seven days, no project/history is removed.
    Build.objects.exclude(state__in=ACTIVE).filter(created_at__lt=now - timedelta(days=7)).delete()


def artifact_path(job):
    if not job.artifact:
        return None
    return Path(settings.COMPILER_ARTIFACT_ROOT) / f"{job.artifact}.zip"


def dispatch(command, data):
    """Private management-command protocol, not an HTTP endpoint."""
    with access_lock():
        cfg = config()
        now = timezone.now()
        if command == "register":
            recipe = data.get("recipe", "")
            require(isinstance(recipe, str) and len(recipe) == 64 and all(c in "0123456789abcdef" for c in recipe))
            require(not Build.objects.filter(state="building").exists(), "Primero reconciliar intentos activos.")
            ceiling = data.get("ceiling")
            require(type(ceiling) is int and 1 <= ceiling <= 4)
            cfg.recipe, cfg.ceiling = recipe, ceiling
            cfg.concurrency = min(cfg.concurrency, ceiling)
            cfg.revision += 1
            cfg.save()
            return {"registered": True}
        cfg.runner_seen = now
        cfg.save(update_fields=["runner_seen"])
        sweep(now)
        if command == "inspect":
            return {"active": [{"id": str(j.pk), "attempt": str(j.attempt), "cancel": j.cancel_requested or not live_project(j), "expired": j.lease_until <= now, "recipe": j.recipe} for j in Build.objects.filter(state="building")],
                    "artifacts": list(str(a) for a in Build.objects.filter(state="ready", expires_at__gt=now, artifact__isnull=False).values_list("artifact", flat=True).distinct())}
        if command == "claim":
            if cfg.paused or not cfg.recipe or Build.objects.filter(state="building").count() >= cfg.concurrency:
                return {"job": None}
            active_owners = list(Build.objects.filter(state="building").values_list("owner_id_snapshot", flat=True))
            candidates = list(Build.objects.filter(state="queued").exclude(owner_id_snapshot__in=active_owners).order_by("created_at", "id"))
            # Least recently served owner; FIFO for that owner. Also works for
            # >1 worker, because selection and reservation share the global lock.
            last = {}
            for owner, started in Build.objects.filter(started_at__isnull=False).values_list("owner_id_snapshot", "started_at"):
                last[owner] = max(last.get(owner, started), started)
            candidates.sort(key=lambda j: (last.get(j.owner_id_snapshot, now - timedelta(days=36500)), j.created_at, str(j.pk)))
            for job in candidates:
                if not live_project(job):
                    forget(job, "cancelled", "El proyecto ya no está disponible para compilar.")
                    continue
                if job.recipe != cfg.recipe:
                    forget(job, "failed", "Se actualizaron las herramientas. Volvé a compilar.")
                    continue
                wifi = json.loads(cipher().decrypt(job.wifi_encrypted.encode()).decode()) if job.wifi_encrypted else None
                snapshot = job.document
                job.state, job.attempt, job.started_at = "building", uuid.uuid4(), now
                job.lease_until = now + timedelta(seconds=45)
                # Inputs are handed off exactly once. Recovery terminates/fails
                # the old attempt, it never needs to retain/replay its secret.
                job.document, job.wifi_encrypted = None, ""
                job.save()
                return {"job": {"id": str(job.pk), "attempt": str(job.attempt), "recipe": job.recipe, "framework": job.framework, "document": snapshot, "wifi": wifi}}
            return {"job": None}
        job = Build.objects.filter(pk=data.get("id"), attempt=data.get("attempt"), state="building").first()
        if not job:
            return {"accepted": False}
        if command == "heartbeat":
            job.lease_until = now + timedelta(seconds=45)
            job.save(update_fields=["lease_until"])
            return {"accepted": True, "cancel": job.cancel_requested or not live_project(job)}
        if command == "finish":
            require(data.get("terminated") is True, "Confirmar la terminación real antes de liberar el cupo.")
            success = data.get("success") is True and not job.cancel_requested and bool(live_project(job))
            job.document, job.wifi_encrypted = None, ""
            metrics = data.get("metrics", {})
            job.metrics = {key: value for key, value in metrics.items() if key in ("seconds", "peakMemoryBytes", "oomKilled", "exitCode") and type(value) in (int, float, bool) and abs(value) <= 10**12}
            if success:
                job.artifact = job.attempt
                path = artifact_path(job)
                try:
                    require(path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= MAX_ARTIFACT)
                    with path.open("rb") as file:
                        checksum = hashlib.file_digest(file, "sha256").hexdigest()
                    require(checksum == data.get("sha256"))
                    # No operator/user-supplied path or filename enters the API.
                    job.artifact_sha256, job.artifact_bytes = checksum, path.stat().st_size
                    job.expires_at = now + timedelta(hours=24)
                    job.state, job.message = "ready", "Firmware listo para descargar."
                except Exception:
                    # Fixed message: never serialize an exception containing source.
                    job.artifact, job.artifact_bytes = None, 0
                    job.state, job.message = "failed", "No se pudo publicar el firmware. Volvé a compilar."
            else:
                job.state = "cancelled" if job.cancel_requested or not live_project(job) else "failed"
                job.message = {"timeout": "Se alcanzó el tiempo máximo. Simplificá el programa o consultá al administrador.", "resources": "No alcanzaron los recursos del compilador.", "generation": "Revisá bloques, conexiones y configuración Wi-Fi.", "restart": "El servidor interrumpió el intento. Podés volver a compilar."}.get(data.get("reason"), "No se pudo compilar. Tu proyecto se conserva.")
            job.finished_at = now
            job.save()
            return {"accepted": True, "state": job.state}
        require(False, "Comando no permitido.")
