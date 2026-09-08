import hashlib
import json
from datetime import timedelta

from django.http import FileResponse, JsonResponse
from django.db.models import Sum
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.crypto import salted_hmac
from django.views.decorators.debug import sensitive_variables

from accounts.management_api import fail
from projects.models import Project
from projects.validation import document, require
from projects.views import endpoint, body, identifier, course_lock
from .models import Build, CompilerEvent
from .services import ACTIVE, artifact_path, cipher, config, forget, live_project, sweep, wifi_value


def metadata(job):
    return {"id": str(job.pk), "projectId": str(job.project_id_snapshot), "revision": job.project_revision, "title": job.title,
            "framework": job.framework, "state": job.state, "containsWifi": job.contains_wifi,
            "createdAt": job.created_at.isoformat(), "startedAt": job.started_at.isoformat() if job.started_at else None,
            "expiresAt": job.expires_at.isoformat(), "message": job.message,
            "sha256": job.artifact_sha256 if job.state == "ready" else None, "bytes": job.artifact_bytes,
            "metrics": job.metrics}


def settings_record(cfg):
    return {"concurrency": cfg.concurrency, "ceiling": cfg.ceiling, "paused": cfg.paused, "revision": cfg.revision,
            "available": bool(cfg.recipe and cfg.runner_seen and cfg.runner_seen > timezone.now() - timedelta(seconds=60))}


@endpoint(["GET", "POST"])
@sensitive_variables()
def collection(request, actor):
    sweep()
    cfg = config()
    if request.method == "GET":
        jobs = Build.objects.filter(owner_id_snapshot=actor.pk).order_by("-created_at")[:30]
        return JsonResponse({"jobs": [metadata(job) for job in jobs if live_project(job)], "settings": settings_record(cfg), "csrfToken": get_token(request)})
    data = body(request, ("id", "projectId", "revision", "framework", "wifi", "wiringReviewed"))
    project = Project.objects.select_related("course").get(pk=identifier(data["projectId"]), owner=actor)
    require(data["framework"] in ("arduino", "esp-idf") and type(data["revision"]) is int and data["wiringReviewed"] is True)
    wifi = wifi_value(data["wifi"])
    operation = identifier(data["id"])
    # Keyed digest: not a password/SSID guessing oracle in DB/backups.
    digest = salted_hmac("capi.compiler.request.v1", json.dumps(data, sort_keys=True), algorithm="sha256").hexdigest()
    old = Build.objects.filter(pk=operation).first()
    if old:
        if old.owner_id_snapshot != actor.pk:
            raise Project.DoesNotExist
        return JsonResponse({"job": metadata(old)}) if old.request_digest == digest else fail("El reintento cambió. Revisá el pedido original.", "operation_conflict", 409)
    if project.trashed_at:
        return fail("Restaurá el proyecto antes de compilar.", "trashed", 409)
    locked = course_lock(project)
    if locked is not None:
        return locked
    if project.revision != data["revision"]:
        return fail("El proyecto cambió en el servidor. Guardá o abrí la versión actual antes de compilar.", "stale_revision", 409)
    if not settings_record(cfg)["available"] or cfg.paused:
        return fail("Las compilaciones están en pausa o el compilador no está disponible. Tu proyecto está guardado.", "compiler_unavailable", 503)
    own = Build.objects.filter(owner_id_snapshot=actor.pk)
    for scope, maximum in ((own, 32_000_000), (Build.objects.all(), 256_000_000)):
        used = scope.aggregate(bytes=Sum("artifact_bytes"))["bytes"] or 0
        reserved = scope.filter(state__in=ACTIVE).count() * 5_000_000
        require(used + reserved + 5_000_000 <= maximum, "No hay espacio temporal para otro firmware. Retirá un resultado o esperá que venza; tus proyectos se conservan.")
    require(own.filter(state__in=ACTIVE).count() < 3 and Build.objects.filter(state__in=ACTIVE).count() < 40, "La cola está llena. Esperá que termine un pedido; no se borró tu proyecto.")
    require(own.count() < 30 and Build.objects.count() < 1000, "Alcanzaste el límite de pedidos de los últimos 7 días. Los anteriores vencen automáticamente.")
    size = document(project.document)
    require(size <= 2_000_000)
    payload = json.dumps(project.document, sort_keys=True, separators=(",", ":")).encode()
    cache_key = hashlib.sha256(payload + cfg.recipe.encode() + data["framework"].encode()).hexdigest()
    job = Build(id=operation, owner_id_snapshot=actor.pk, project_id_snapshot=project.pk, project_revision=project.revision,
                title=project.title, framework=data["framework"], recipe=cfg.recipe, request_digest=digest, cache_key=cache_key,
                document=project.document, contains_wifi=wifi is not None, expires_at=timezone.now() + timedelta(hours=1),
                wifi_encrypted=cipher().encrypt(json.dumps(wifi).encode()).decode() if wifi else "")
    # Cache is private to owner + project + source/config/toolchain identity.
    # Never reuse password-bearing builds, even for the same account.
    cached = None if wifi else own.filter(project_id_snapshot=project.pk, cache_key=cache_key, contains_wifi=False, state="ready", expires_at__gt=timezone.now()).order_by("-created_at").first()
    if cached and artifact_path(cached) and artifact_path(cached).is_file():
        job.state, job.document = "ready", None
        job.artifact, job.artifact_sha256, job.artifact_bytes = cached.artifact, cached.artifact_sha256, cached.artifact_bytes
        job.expires_at, job.finished_at = cached.expires_at, timezone.now()
        job.message = "Firmware reutilizado de tu mismo proyecto, programa y herramientas."
    job.save()
    return JsonResponse({"job": metadata(job)}, status=201)


def owned(actor, job_id):
    job = Build.objects.filter(pk=job_id, owner_id_snapshot=actor.pk).first()
    if not job or not live_project(job):
        raise Project.DoesNotExist
    return job


@endpoint(["GET", "DELETE"])
def detail(request, actor, job_id):
    sweep()
    job = owned(actor, job_id)
    if request.method == "DELETE":
        if job.state == "building":
            return fail("Ya se está compilando. Cerrar esta ventana no interrumpe el trabajo.", "already_building", 409)
        if job.state != "cancelled":
            forget(job, "cancelled", "Pedido cancelado; firmware retirado del servidor.")
    return JsonResponse({"job": metadata(job)})


@endpoint(["GET"])
def download(request, actor, job_id):
    sweep()
    job = owned(actor, job_id)
    if job.state != "ready" or not job.artifact:
        return fail("El firmware no está disponible o ya venció.", "artifact_unavailable", 410)
    try:
        path = artifact_path(job)
        if path.is_symlink() or path.stat().st_size != job.artifact_bytes:
            raise OSError
        file = path.open("rb")
    except OSError:
        return fail("El archivo no está disponible. Volvé a compilar.", "artifact_unavailable", 410)
    result = FileResponse(file, as_attachment=True, filename=f"capibloques-{job.framework}-r{job.project_revision}-{job.pk}.zip", content_type="application/zip")
    result["X-Capi-Firmware-SHA256"] = job.artifact_sha256
    result["Cache-Control"] = "private, no-store"
    return result


@endpoint(["GET", "PUT"])
def management(request, actor):
    if not actor.is_administrator:
        return fail("Sólo el administrador configura las compilaciones.", "forbidden", 403)
    cfg = config()
    if request.method == "PUT":
        data = body(request, ("revision", "concurrency", "paused"))
        require(type(data["revision"]) is int and type(data["concurrency"]) is int and type(data["paused"]) is bool)
        if data["revision"] != cfg.revision:
            return fail("La configuración cambió. Actualizá antes de guardar.", "stale_revision", 409)
        require(1 <= data["concurrency"] <= cfg.ceiling, "La cantidad supera el techo operativo medido en este servidor.")
        before = settings_record(cfg)
        cfg.concurrency, cfg.paused = data["concurrency"], data["paused"]
        cfg.revision += 1
        cfg.save()
        CompilerEvent.objects.create(actor_id_snapshot=actor.pk, before=before, after=settings_record(cfg))
    # Aggregate metrics only: admin is not a private-project/credential viewer.
    recent = Build.objects.filter(finished_at__isnull=False).order_by("-finished_at")[:20]
    return JsonResponse({"settings": settings_record(cfg), "queued": Build.objects.filter(state="queued").count(), "building": Build.objects.filter(state="building").count(),
                         "recent": [{"framework": j.framework, "state": j.state, "metrics": j.metrics} for j in recent], "csrfToken": get_token(request)})
