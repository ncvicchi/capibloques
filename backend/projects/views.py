import copy
import hashlib
import json
import uuid
from functools import wraps

from django.contrib.auth import logout
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import Sum
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from accounts.management_api import fail
from accounts.models import User, access_lock
from accounts.security import require_account
from accounts.views import user_data
from courses.models import Course, Membership
from courses.views import belonging
from .models import Project, ProjectEvent
from .validation import document, encoded, exact, require, title

MAX_PROJECTS = 100
MAX_ACCOUNT_BYTES = 50_000_000


def endpoint(methods):
    def decorate(view):
        @wraps(view)
        def checked(request, *args, **kwargs):
            try:
                # Auth fresca y mutación atómica, también frente a desactivación
                # simultánea. Ningún administrador tiene acceso por ser admin.
                with access_lock():
                    actor = User.objects.filter(pk=request.user.pk).first()
                    if not actor or not actor.is_active or actor.session_epoch != request.user.session_epoch:
                        logout(request)
                        return fail("Tu sesión cambió. Volvé a ingresar.", "login_required", 401)
                    if actor.must_change_password:
                        return fail("Primero elegí tu contraseña definitiva.", "password_change_required", 403)
                    if request.headers.get("X-Capi-Account") != str(actor.pk):
                        return fail("La cuenta activa no coincide con esta pestaña. Ingresá nuevamente.", "account_changed", 409)
                    return view(request, actor, *args, **kwargs)
            except (Project.DoesNotExist, Course.DoesNotExist):
                return fail("El proyecto no está disponible para tu cuenta.", "not_found", 404)
            except ValidationError as error:
                return fail(" ".join(error.messages))
            except IntegrityError:
                return fail("La operación entra en conflicto con otro cambio. Actualizá la biblioteca.", "conflict", 409)
        return never_cache(require_http_methods(methods)(require_account()(checked)))
    return decorate


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "El JSON contiene propiedades repetidas.")
        result[key] = value
    return result


def body(request, fields):
    try:
        data = json.loads(request.body, object_pairs_hook=no_duplicates, parse_constant=lambda value: (_ for _ in ()).throw(ValueError()))
        exact(data, fields)
        return data
    except (ValueError, UnicodeError, RecursionError):
        raise ValidationError("El JSON está dañado o excede la complejidad permitida.") from None


def identifier(value):
    try:
        require(isinstance(value, str))
        return uuid.UUID(value)
    except (ValueError, AttributeError):
        raise ValidationError("La identidad de la operación no es válida.") from None


def metadata(project):
    return {"id": str(project.pk), "title": project.title, "revision": project.revision,
            "updatedAt": project.updated_at.isoformat(), "trashedAt": project.trashed_at.isoformat() if project.trashed_at else None,
            "course": {"id": str(project.course_id), "name": project.course.name, "isArchived": project.course.is_archived, "ownerCanEdit": owner_can_edit(project)} if project.course_id else None}


def owner_can_edit(project):
    return not project.course_id or (not project.course.is_archived and Membership.objects.filter(course_id=project.course_id, user_id=project.owner_id, role="alumno", user__is_active=True, user__is_student=True).exists())


def course_lock(project):
    if not owner_can_edit(project):
        return fail("El curso está archivado o ya no estás asignado como alumno. Tu proyecto se conserva: exportalo o creá una copia personal para continuar.", "course_locked", 409)
    return None


def digest(data, action):
    try:
        return hashlib.sha256(encoded([action, data])).hexdigest()
    except (ValueError, UnicodeError, RecursionError):
        raise ValidationError("El JSON contiene valores no compatibles.") from None


def response(project, status=200):
    return JsonResponse({"project": metadata(project)}, status=status)


def audit(actor, project, action):
    ProjectEvent.objects.create(actor=actor, actor_id_snapshot=actor.pk, project_id_snapshot=project.pk, revision=project.revision, action=action)


def quota(actor, size, previous_size=0, creating=False):
    projects = Project.objects.filter(owner=actor)
    require(not creating or projects.count() < MAX_PROJECTS, "Alcanzaste los 100 proyectos (incluida la papelera). No se borró ningún trabajo. Pedile ayuda al administrador.")
    used = projects.aggregate(size=Sum("size_bytes"))["size"] or 0
    require(used - previous_size + size <= MAX_ACCOUNT_BYTES, "Alcanzaste los 50 MB de tu biblioteca. Tu trabajo actual se conserva en el editor; podés exportarlo.")


def replay(project, data, action):
    operation = identifier(data["operationId"])
    if operation == project.last_operation:
        if digest(data, action) == project.last_digest:
            return response(project)
        return fail("Ese reintento no coincide con la operación original.", "operation_conflict", 409)
    return None


def check_revision(project, data):
    require(type(data["revision"]) is int and data["revision"] > 0)
    if data["revision"] != project.revision:
        return fail("Otra pestaña o dispositivo cambió este proyecto. Abrí la versión del servidor o guardá tu trabajo como una copia nueva.", "stale_revision", 409)
    return None


def finish(actor, project, data, action):
    project.revision += 1
    project.last_operation, project.last_digest = identifier(data["operationId"]), digest(data, action)
    project.save()
    audit(actor, project, action)
    return response(project)


@endpoint(["GET", "POST"])
def collection(request, actor):
    if request.method == "GET":
        query, state = request.GET.get("q", "").strip(), request.GET.get("state", "active")
        try:
            page = int(request.GET.get("page", "1"))
            require(1 <= page <= 100000 and len(query) <= 80 and state in ("active", "trash"))
        except ValueError:
            raise ValidationError("Revisá la búsqueda y la página.") from None
        projects = Project.objects.select_related("course").filter(owner=actor, trashed_at__isnull=state == "active", title__icontains=query)
        count = projects.count()
        page = min(page, max(1, (count + 19) // 20))
        return JsonResponse({"projects": [metadata(item) for item in projects.defer("document").order_by("-updated_at", "id")[(page - 1) * 20:page * 20]],
                             "count": count, "page": page, "pageSize": 20, "actor": user_data(actor), "csrfToken": get_token(request),
                             "limits": {"projects": MAX_PROJECTS, "bytes": MAX_ACCOUNT_BYTES}})
    data = body(request, ("id", "operationId", "document"))
    project_id = identifier(data["id"])
    operation = identifier(data["operationId"])
    existing = Project.objects.filter(pk=project_id).first()
    if existing:
        if existing.owner_id != actor.pk:
            raise Project.DoesNotExist
        repeated = replay(existing, data, "created")
        return repeated if repeated is not None else fail("La identidad del proyecto ya fue utilizada. Abrí la biblioteca para revisar el resultado.", "operation_conflict", 409)
    size = document(data["document"])
    quota(actor, size, creating=True)
    project = Project.objects.create(pk=project_id, owner=actor, title=title(data["document"]["metadata"]["title"]), document=data["document"], size_bytes=size, last_operation=operation, last_digest=digest(data, "created"))
    audit(actor, project, "created")
    return response(project, 201)


@endpoint(["GET", "PUT"])
def detail(request, actor, project_id):
    project = Project.objects.select_related("course").get(pk=project_id, owner=actor)
    if request.method == "GET":
        if request.GET.get("metadata") == "1":
            return response(project)
        return JsonResponse({"project": metadata(project), "document": project.document})
    data = body(request, ("operationId", "revision", "document"))
    repeated = replay(project, data, "saved")
    if repeated is not None:
        return repeated
    conflict = check_revision(project, data)
    if conflict is not None:
        return conflict
    if project.trashed_at:
        return fail("El proyecto está en la papelera. No se sobrescribió ni se restauró. Guardá una copia nueva o restauralo explícitamente.", "trashed", 409)
    locked = course_lock(project)
    if locked is not None:
        return locked
    size = document(data["document"])
    quota(actor, size, project.size_bytes)
    project.document, project.title, project.size_bytes = data["document"], title(data["document"]["metadata"]["title"]), size
    return finish(actor, project, data, "saved")


@endpoint(["POST"])
def action(request, actor, project_id, action):
    project = Project.objects.get(pk=project_id, owner=actor)
    data = body(request, ("operationId", "revision", "title") if action == "rename" else ("operationId", "revision"))
    repeated = replay(project, data, action)
    if repeated is not None:
        return repeated
    conflict = check_revision(project, data)
    if conflict is not None:
        return conflict
    if action == "rename":
        if project.trashed_at:
            return fail("Restaurá el proyecto antes de renombrarlo.", "trashed", 409)
        locked = course_lock(project)
        if locked is not None:
            return locked
        project.title = title(data["title"])
        changed = copy.deepcopy(project.document)
        changed["metadata"]["title"] = project.title
        changed["metadata"]["updatedAt"] = timezone.now().isoformat()
        size = document(changed)
        quota(actor, size, project.size_bytes)
        project.document, project.size_bytes = changed, size
    elif action == "trash":
        if project.trashed_at:
            return fail("El proyecto ya está en la papelera.", "trashed", 409)
        project.trashed_at = timezone.now()
    elif action == "restore":
        if not project.trashed_at:
            return fail("El proyecto ya estaba activo.", "not_trashed", 409)
        project.trashed_at = None
    return finish(actor, project, data, action)


@endpoint(["GET"])
def eligible_courses(request, actor):
    courses = belonging(actor).filter(role="alumno", course__is_archived=False).select_related("course").order_by("course__name")
    return JsonResponse({"courses": [{"id": str(item.course_id), "name": item.course.name} for item in courses]})


@endpoint(["POST"])
def link_course(request, actor, project_id):
    project = Project.objects.select_related("course").get(pk=project_id, owner=actor)
    data = body(request, ("operationId", "revision", "courseId"))
    repeated = replay(project, data, "course_changed")
    if repeated is not None:
        return repeated
    conflict = check_revision(project, data)
    if conflict is not None:
        return conflict
    require(not project.trashed_at, "Restaurá el proyecto antes de cambiar su curso.")
    locked = course_lock(project)
    if locked is not None:
        return locked
    course = None
    if data["courseId"] is not None:
        member = belonging(actor).filter(role="alumno", course_id=identifier(data["courseId"]), course__is_archived=False).select_related("course").first()
        if not member:
            raise Project.DoesNotExist
        course = member.course
    project.course = course
    return finish(actor, project, data, "course_changed")


@endpoint(["GET"])
def course_projects(request, actor, course_id, project_id=None):
    if not belonging(actor).filter(course_id=course_id, role="docente").exists():
        raise Project.DoesNotExist
    # También el propietario debe seguir siendo alumno activo del mismo curso.
    enrolled = Membership.objects.filter(course_id=course_id, role="alumno", user__is_active=True, user__is_student=True).values("user_id")
    projects = Project.objects.filter(course_id=course_id, owner_id__in=enrolled, trashed_at__isnull=True).select_related("owner", "course")
    if project_id:
        project = projects.get(pk=project_id)
        return JsonResponse({"project": metadata(project), "document": project.document})
    query = request.GET.get("q", "").strip()
    try:
        page = int(request.GET.get("page", "1"))
        require(1 <= page <= 100000 and len(query) <= 80)
    except ValueError:
        raise ValidationError("Revisá la búsqueda y la página.") from None
    projects = projects.filter(title__icontains=query)
    count = projects.count()
    page = min(page, max(1, (count + 19) // 20))
    return JsonResponse({"projects": [{**metadata(project), "owner": {"displayName": project.owner.display_name, "alias": project.owner.username}} for project in projects.defer("document").order_by("-updated_at", "id")[(page-1)*20:page*20]], "count": count, "page": page, "pageSize": 20})
