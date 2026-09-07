"""Baja explícita de una cuenta inactiva, sin cascadas incidentales.

El recibo prueba que se GENERÓ un respaldo de la versión actual para este actor;
no puede probar que una persona conservó el archivo en su disco.
"""
import hashlib
import json
import tempfile
import zipfile
import uuid

from django.core import signing
from django.core.exceptions import ValidationError
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from projects.models import Project, ProjectRevision
from projects.views import retire_project
from projects.validation import encoded
from .management_api import audit, body, endpoint, fail, locked_actor, record, text_field
from .models import User, access_lock

SALT = "capibloques.account-deletion-backup-v1"


def summary(target):
    rows = list(target.projects.order_by("id").values_list("id", "revision", "size_bytes", "trashed_at", "course_id", "course__name"))
    members = list(target.course_memberships.order_by("id").values_list("id", "course_id", "role"))
    history = list(ProjectRevision.objects.filter(project__owner=target).order_by("project_id", "revision").values_list("project_id", "revision", "size_bytes", "pinned"))
    version = salted_hmac(SALT, json.dumps([record(target)["version"], rows, members, history], default=str), algorithm="sha256").hexdigest()
    return {"user": record(target), "projects": {"count": len(rows), "active": sum(row[3] is None for row in rows), "trash": sum(row[3] is not None for row in rows), "bytes": sum(row[2] for row in rows), "historyCount": len(history), "historyBytes": sum(row[2] for row in history)}, "memberships": len(members), "version": version,
            "canDelete": not target.is_active and not members}


def actor_for(request):
    actor = locked_actor(request)
    if not actor or request.headers.get("X-Capi-Account") != str(actor.pk):
        raise ValidationError("La cuenta administradora cambió. Volvé a abrir Gestión de usuarios.")
    return actor


def prepared(target, data):
    current = summary(target)
    if not constant_time_compare(text_field(data, "version", 64), current["version"]):
        raise ValidationError("La cuenta o sus proyectos cambiaron. Cancelá y volvé a preparar la baja y el respaldo.")
    if target.is_active or current["memberships"]:
        raise ValidationError("Primero desactivá la cuenta y retirá todas sus membresías. Sus proyectos se conservarán hasta confirmar esta baja.")
    return current


@endpoint(["GET", "DELETE"])
def deletion(request, user_id):
    with access_lock():
        actor = actor_for(request)
        target = User.objects.get(pk=user_id)
        if request.method == "GET":
            return JsonResponse(summary(target))
        data = body(request, {"version", "confirmationAlias", "understandsLocalDrafts", "understandsPermanent", "backupReceipt"})
        current = prepared(target, data)
        if text_field(data, "confirmationAlias", 32) != target.username or data["understandsLocalDrafts"] is not True or data["understandsPermanent"] is not True:
            return fail("Confirmá el alias exacto y ambas advertencias antes de eliminar.")
        if current["projects"]["count"]:
            try:
                receipt = signing.loads(text_field(data, "backupReceipt", 2048), salt=SALT, max_age=600)
                if receipt["actor"] != str(actor.pk) or receipt["epoch"] != actor.session_epoch or receipt["target"] != str(target.pk) or receipt["version"] != current["version"]:
                    raise ValueError
            except (signing.BadSignature, ValueError, KeyError, TypeError):
                return fail("Descargá nuevamente el respaldo actual antes de confirmar (vigencia: 10 minutos).", "backup_required", 409)
        # Objetos exactos verificados en esta transacción. Auditar antes de borrar,
        # conservando UUIDs; nunca tocar cuentas, cursos o proyectos ajenos.
        owned = Project.objects.filter(owner=target)
        audit(actor, target, "deleted", ["projects"] if current["projects"]["count"] else [])
        for item in owned.defer("document"):
            retire_project(actor, item, uuid.uuid4(), current["version"], "account_deleted")
        target.delete()  # Sigue comprobando último admin y relaciones PROTECT.
        return JsonResponse({"deleted": True, "projectsDeleted": current["projects"]["count"], "sessionEnded": False})


@endpoint(["POST"])
def backup(request, user_id):
    data = body(request, {"version", "confirmsPrivateBackup"})
    with access_lock():
        actor = actor_for(request)
        target = User.objects.get(pk=user_id)
        current = prepared(target, data)
        if data["confirmsPrivateBackup"] is not True:
            return fail("Confirmá que vas a preparar el respaldo privado para esta baja.")
        # Cuotas de 3A. No convertir futuros incrementos en archivos sin límite.
        if current["projects"]["count"] > 100 or current["projects"]["bytes"] > 50_000_000 or current["projects"]["historyBytes"] > 50_000_000:
            return fail("La cuenta supera el tamaño de respaldo admitido. No se eliminó ningún dato.")
        archive = None
        try:
            archive = tempfile.TemporaryFile(mode="w+b", dir="/tmp")
            manifest = {"application": "CapiBloquesAccountBackup", "schemaVersion": 1, "exportedAt": timezone.now().isoformat(), "account": {key: value for key, value in current["user"].items() if key != "version"}, "projects": []}
            with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as bundle:
                # Un documento a la vez, no la biblioteca completa en memoria.
                for project in target.projects.select_related("course").order_by("id").iterator(chunk_size=1):
                    filename = f"projects/{project.pk}.capibloques.json"
                    contents = encoded(project.document)
                    bundle.writestr(filename, contents)
                    entry = {"id": str(project.pk), "title": project.title, "revision": project.revision, "file": filename, "sha256": hashlib.sha256(contents).hexdigest(), "trashedAt": project.trashed_at.isoformat() if project.trashed_at else None, "course": {"id": str(project.course_id), "name": project.course.name} if project.course_id else None, "history": []}
                    for version in project.history.iterator(chunk_size=1):
                        filename = f"history/{project.pk}/{version.revision}.capibloques.json"
                        contents = encoded(version.document)
                        bundle.writestr(filename, contents)
                        entry["history"].append({"revision": version.revision, "title": version.title, "kind": version.kind, "pinned": version.pinned, "createdAt": version.created_at.isoformat(), "file": filename, "sha256": hashlib.sha256(contents).hexdigest()})
                    manifest["projects"].append(entry)
                bundle.writestr("manifest.json", encoded(manifest))
                bundle.writestr("LEEME.txt", "Respaldo privado de baja de cuenta. Incluye proyectos actuales e historial en history/. No contiene contraseñas, sesiones ni borradores locales. Para recuperar trabajos: crear una cuenta e importar por separado los JSON; obtendrán nueva identidad personal, sin compartir automáticamente con cursos. Guardar este ZIP en un lugar privado. No restaura automáticamente la cuenta original ni su historial como conjunto.\n")
            archive.seek(0)
            checksum = hashlib.file_digest(archive, "sha256").hexdigest()
            receipt = signing.dumps({"actor": str(actor.pk), "epoch": actor.session_epoch, "target": str(target.pk), "version": current["version"], "sha256": checksum}, salt=SALT)
            audit(actor, target, "deletion_backup_created", ["projects"])
            archive.seek(0)
            response = FileResponse(archive, as_attachment=True, filename=f"respaldo-cuenta-{target.pk}.zip", content_type="application/zip")
            response["X-Capi-Backup-Receipt"] = receipt
            response["X-Capi-Backup-SHA256"] = checksum
            return response
        except OSError:
            if archive is not None:
                archive.close()
            return fail("No se pudo preparar el respaldo con los recursos disponibles. No se eliminó ningún dato.", "backup_unavailable", 503)
        except Exception:
            if archive is not None:
                archive.close()
            raise
