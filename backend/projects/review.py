"""Supervisión de versiones guardadas. Todas las rutas revalidan bajo access_lock.

La UI de revisión no es un editor delegado: ninguna ruta escribe el original.
Las versiones legacy sin contexto sólo son visibles para su propietario.
"""
import copy

from django.db.models import Sum
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone

from courses.models import Membership
from courses.views import belonging
from .history import archive_current, revision_metadata
from .models import Project, ProjectDeletion, ProjectFeedback
from .validation import document, encoded, require
from .views import endpoint, body, identifier, metadata, owner_can_edit, digest, fail, quota, audit, replay, response

MAX_FEEDBACK = 50
MAX_FEEDBACK_BYTES = 10_000_000


def permitted(request, actor, project_id):
    project = Project.objects.select_related("owner", "course").get(pk=project_id)
    context = request.GET.get("course", "")
    if context and str(project.course_id) != context:
        raise Project.DoesNotExist
    if project.owner_id == actor.pk:
        return project
    if (not context or not project.course_id or project.trashed_at
            or not belonging(actor).filter(course_id=project.course_id, role="docente").exists()
            or not Membership.objects.filter(course_id=project.course_id, user_id=project.owner_id,
                                              role="alumno", user__is_active=True, user__is_student=True).exists()):
        raise Project.DoesNotExist
    return project


def versions(project, actor):
    rows = project.history.exclude(revision=project.revision).defer("document")
    if project.owner_id != actor.pk:
        rows = rows.filter(course_id=project.course_id)
    return [revision_metadata(project)] + [revision_metadata(project, row) for row in rows]


def snapshot(project, actor, revision, create=False):
    row = project.history.filter(revision=revision).first()
    if revision == project.revision and create:
        archive_current(project, force=True)
        row = project.history.get(revision=revision)
        # Una versión actual creada antes de incorporar contexto puede fijarse
        # ahora: coincide con el documento actual, no con una versión histórica.
        if row.course_id is None and project.course_id:
            row.course_id = project.course_id
            row.save(update_fields=["course"])
    if not row or (project.owner_id != actor.pk and row.course_id != project.course_id):
        raise Project.DoesNotExist
    return row


def feedback_record(item):
    return {"id": str(item.pk), "revision": item.snapshot.revision,
            "author": {"displayName": item.author.display_name, "alias": item.author.username} if item.author else None,
            "text": item.text, "reply": item.reply, "resolved": item.resolved, "version": item.version,
            "createdAt": item.created_at.isoformat(), "updatedAt": item.updated_at.isoformat()}


def feedback_rows(project):
    return ProjectFeedback.objects.filter(snapshot__project=project).select_related("snapshot", "author").defer("snapshot__document")


def writable(project):
    require(project.course_id and not project.trashed_at and owner_can_edit(project),
            "Las devoluciones están en sólo lectura: el curso está archivado, el proyecto está en papelera o el alumno ya no pertenece al curso.")


def plain_text(value, empty=False):
    require(isinstance(value, str) and len(value) <= 1000, "Usá hasta 1000 caracteres de texto por mensaje.")
    require(all(c in "\n\t" or (ord(c) >= 32 and ord(c) != 127 and not 0xD800 <= ord(c) <= 0xDFFF) for c in value), "El mensaje contiene caracteres no admitidos.")
    value = value.strip()
    require(empty or bool(value), "Escribí una devolución antes de enviar.")
    return value


def feedback_quota(project, size, previous=0):
    used = ProjectFeedback.objects.filter(snapshot__project__owner_id=project.owner_id).aggregate(size=Sum("size_bytes"))["size"] or 0
    require(used - previous + size <= MAX_FEEDBACK_BYTES, "Esta biblioteca alcanzó el límite de 10 MB de devoluciones. No se descartó ningún mensaje ni proyecto.")


@endpoint(["GET"])
def status(request, actor, project_id):
    project = permitted(request, actor, project_id)
    owner = project.owner_id == actor.pk
    can_write = bool(project.course_id and not project.trashed_at and owner_can_edit(project))
    rows = feedback_rows(project)
    if not owner:
        rows = rows.filter(snapshot__course_id=project.course_id)
    return JsonResponse({"project": metadata(project), "owner": {"displayName": project.owner.display_name, "alias": project.owner.username},
                         "versions": versions(project, actor), "feedback": [feedback_record(row) for row in rows],
                         "canComment": can_write and not owner, "canRespond": can_write and owner,
                         "isOwner": owner, "csrfToken": get_token(request),
                         "limits": {"comments": MAX_FEEDBACK, "characters": 1000}})


@endpoint(["GET", "POST"])
def version(request, actor, project_id, revision):
    project = permitted(request, actor, project_id)
    if request.method == "POST":
        body(request, ())
    row = snapshot(project, actor, revision, create=request.method == "POST")
    return JsonResponse({"version": {**revision_metadata(project, row), "current": revision == project.revision}, "document": row.document})


@endpoint(["POST"])
def comment(request, actor, project_id):
    project = permitted(request, actor, project_id)
    require(project.owner_id != actor.pk, "Las devoluciones las inicia un docente asignado; el alumno puede responderlas.")
    writable(project)
    data = body(request, ("id", "revision", "text"))
    comment_id = identifier(data["id"])
    require(type(data["revision"]) is int and data["revision"] > 0)
    existing = ProjectFeedback.objects.filter(pk=comment_id).first()
    fingerprint = digest([str(project.pk), data], "feedback_created")
    if existing:
        if existing.author_id == actor.pk and existing.snapshot.project_id == project.pk and existing.creation_digest == fingerprint:
            return JsonResponse({"feedback": feedback_record(existing)})
        return fail("La identidad de este envío ya se utilizó para otro mensaje.", "operation_conflict", 409)
    row = snapshot(project, actor, data["revision"])
    require(row.course_id == project.course_id, "Esta versión pertenece a otro contexto. Abrí una versión de este curso.")
    text = plain_text(data["text"])
    require(feedback_rows(project).count() < MAX_FEEDBACK, "Este proyecto alcanzó las 50 devoluciones. Podés continuar el trabajo en una copia nueva; el original conserva la conversación.")
    size = len(encoded([text, ""]))
    feedback_quota(project, size)
    row.pinned = True
    row.save(update_fields=["pinned"])
    item = ProjectFeedback.objects.create(pk=comment_id, snapshot=row, author=actor, text=text, size_bytes=size, creation_digest=fingerprint)
    audit(actor, project, "feedback_created")
    return JsonResponse({"feedback": feedback_record(item)}, status=201)


@endpoint(["PATCH"])
def respond(request, actor, project_id, feedback_id):
    project = permitted(request, actor, project_id)
    if project.owner_id != actor.pk:
        raise Project.DoesNotExist
    writable(project)
    item = feedback_rows(project).filter(pk=feedback_id, snapshot__course_id=project.course_id).first()
    if not item:
        raise Project.DoesNotExist
    data = body(request, ("operationId", "version", "reply", "resolved"))
    operation = identifier(data["operationId"])
    fingerprint = digest(data, "feedback_responded")
    if item.last_operation == operation:
        if item.last_digest == fingerprint:
            return JsonResponse({"feedback": feedback_record(item)})
        return fail("Ese reintento no coincide con la respuesta original.", "operation_conflict", 409)
    require(type(data["version"]) is int and type(data["resolved"]) is bool)
    if data["version"] != item.version:
        return fail("La respuesta cambió en otra pestaña. Tu texto sigue aquí: actualizá y revisá antes de volver a guardarlo.", "stale_revision", 409)
    reply = plain_text(data["reply"], empty=True)
    size = len(encoded([item.text, reply]))
    feedback_quota(project, size, item.size_bytes)
    item.reply, item.resolved, item.size_bytes = reply, data["resolved"], size
    item.version += 1
    item.last_operation, item.last_digest = operation, fingerprint
    item.save()
    audit(actor, project, "feedback_responded")
    return JsonResponse({"feedback": feedback_record(item)})


@endpoint(["POST"])
def make_copy(request, actor, project_id, revision):
    project = permitted(request, actor, project_id)
    data = body(request, ("id", "operationId"))
    target = identifier(data["id"])
    operation = identifier(data["operationId"])
    action = f"review_copy:{project.pk}:{revision}"
    if ProjectDeletion.objects.filter(pk=target).exists():
        return fail("Esa copia fue eliminada definitivamente. Iniciá una copia nueva.", "purged", 410)
    existing = Project.objects.filter(pk=target).first()
    if existing:
        if existing.owner_id != actor.pk:
            raise Project.DoesNotExist
        repeated = replay(existing, data, action)
        return repeated if repeated is not None else fail("La copia ya existe y cambió. Buscala en Mis proyectos.", "operation_conflict", 409)
    row = snapshot(project, actor, revision)
    clone = copy.deepcopy(row.document)
    clone["metadata"]["title"] = f"Copia de {row.title}"[:80]
    clone["metadata"]["updatedAt"] = timezone.now().isoformat()
    size = document(clone)
    quota(actor, size, creating=True)
    result = Project.objects.create(pk=target, owner=actor, title=clone["metadata"]["title"], document=clone, size_bytes=size,
                                    last_operation=operation, last_digest=digest(data, action),
                                    provenance={"title": row.title, "revision": revision, "course": row.course.name if row.course_id else None})
    audit(actor, result, "review_copy")
    return response(result, 201)
