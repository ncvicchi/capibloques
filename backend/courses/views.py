"""Cursos: administración global separada de la pertenencia pedagógica.

Todas las operaciones (también lecturas de listas) se serializan con cambios de
acceso. Nunca se usa la lista enviada por el navegador como autorización.
"""
import json
import uuid
from functools import wraps

from django.contrib.auth import logout
from django.core.exceptions import RequestDataTooBig, ValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from accounts.models import User, access_lock
from accounts.management_api import fail
from accounts.security import require_account
from accounts.views import user_data
from .models import Course, CourseEvent, Membership

VALID_MEMBERS = Q(user__is_active=True) & (Q(role="docente", user__is_teacher=True) | Q(role="alumno", user__is_student=True))
FIELDS = {"name", "description", "isArchived", "members"}
MAX_MEMBERS = 200


def endpoint(methods, management=False):
    def decorate(view):
        @wraps(view)
        def checked(request, *args, **kwargs):
            try:
                with access_lock():
                    actor = User.objects.filter(pk=request.user.pk).first()
                    if not actor or not actor.is_active or actor.session_epoch != request.user.session_epoch:
                        logout(request)
                        return fail("Tu acceso cambió. Ingresá nuevamente.", "login_required", 401)
                    if actor.must_change_password or (management and not actor.is_administrator):
                        return fail("Tu cuenta no tiene permiso para esta acción.", "forbidden", 403)
                    return view(request, actor, *args, **kwargs)
            except Course.DoesNotExist:
                return fail("El curso no está disponible para tu cuenta. Actualizá el listado.", "not_found", 404)
            except ValidationError as error:
                return fail(" ".join(error.messages))
            except IntegrityError:
                return fail("Ya existe un curso con ese nombre. Elegí otro nombre.", "course_conflict", 409)
        return never_cache(require_http_methods(methods)(require_account(*(["administrador"] if management else []))(checked)))
    return decorate


def basic(course):
    return {"id": str(course.pk), "name": course.name, "description": course.description, "isArchived": course.is_archived}


def member_record(membership, management):
    user = membership.user
    result = {"id": str(user.pk), "alias": user.username, "displayName": user.display_name, "role": membership.role}
    if management:
        result["isActive"] = user.is_active
    return result


def managed_record(course):
    data = {**basic(course), "members": [member_record(member, True) for member in course.memberships.select_related("user").order_by("user__username")]}
    # El token incluye nombres/estado: editar una cuenta invalida también una
    # selección antigua, sin revocar membresías cuando cambia una contraseña.
    data["version"] = salted_hmac("capibloques.course-version", str(course.version) + json.dumps(data, sort_keys=True), algorithm="sha256").hexdigest()
    return data


def paginated(request, queryset):
    query = request.GET.get("q", "").strip()
    status = request.GET.get("status", "active")
    try:
        page = int(request.GET.get("page", "1"))
        if not 1 <= page <= 100000 or len(query) > 100 or status not in ("active", "archived", "all"):
            raise ValueError
    except ValueError:
        raise ValidationError("Revisá la búsqueda y la página.") from None
    queryset = queryset.filter(name__icontains=query)
    if status != "all":
        queryset = queryset.filter(is_archived=status == "archived")
    count = queryset.count()
    page = min(page, max(1, (count + 19) // 20))
    return queryset.order_by("name", "id")[(page - 1) * 20:page * 20], {"count": count, "page": page, "pageSize": 20}


def payload(request, creating):
    try:
        if request.content_type != "application/json" or len(request.body) > 16384:
            raise ValueError
        data = json.loads(request.body)
        if not isinstance(data, dict) or set(data) != (FIELDS if creating else FIELDS | {"version"}):
            raise ValueError
        for field, limit in (("name", 100), ("description", 500)):
            if not isinstance(data[field], str) or len(data[field]) > limit or any(ord(c) < 32 for c in data[field]):
                raise ValueError
            data[field] = data[field].strip()
        if not data["name"] or type(data["isArchived"]) is not bool:
            raise ValueError
        if not creating and (not isinstance(data["version"], str) or len(data["version"]) != 64):
            raise ValueError
        if not isinstance(data["members"], list) or len(data["members"]) > MAX_MEMBERS:
            raise ValueError
        members = {}
        for item in data["members"]:
            if not isinstance(item, dict) or set(item) != {"id", "role"} or item["role"] not in ("docente", "alumno") or not isinstance(item["id"], str):
                raise ValueError
            member_id = uuid.UUID(item["id"])
            if member_id in members:
                raise ValueError
            members[member_id] = item["role"]
        return data, members
    except (ValueError, TypeError, UnicodeError, RequestDataTooBig):
        raise ValidationError("Revisá el nombre, la descripción y la selección (máximo 200 miembros).") from None


def save(request, actor, course=None):
    creating = course is None
    data, members = payload(request, creating)
    course = course or Course()
    before = None if creating else managed_record(course)
    if before and not constant_time_compare(data["version"], before["version"]):
        return fail("El curso o sus cuentas cambiaron. Cancelá y volvé a abrirlo antes de guardar.", "stale_version", 409)
    previous = {} if creating else dict(course.memberships.values_list("user_id", "role"))
    additions = {pk: role for pk, role in members.items() if previous.get(pk) != role}
    removals = {pk: role for pk, role in previous.items() if members.get(pk) != role}
    if additions and (course.is_archived or data["isArchived"]):
        raise ValidationError("No se pueden incorporar miembros a un curso archivado. Guardá su reactivación primero.")
    users = User.objects.in_bulk(members)
    for pk, role in members.items():
        user = users.get(pk)
        if not user or role not in user.roles or (pk in additions and not user.is_active):
            raise ValidationError("Una cuenta ya no es elegible para ese rol. Cancelá y revisá la selección.")
    changes = [key for key in ("name", "description", "isArchived") if not before or before[key] != data[key]]
    if not creating and not changes and not additions and not removals:
        return JsonResponse({"course": before})
    course.name, course.description, course.is_archived = data["name"], data["description"], data["isArchived"]
    course.version = uuid.uuid4()
    course.save()
    # Borrar únicamente relaciones seleccionadas; nunca usuarios ni cursos.
    course.memberships.filter(user_id__in=removals).delete()
    Membership.objects.bulk_create([Membership(course=course, user_id=pk, role=role) for pk, role in additions.items()])
    CourseEvent.objects.create(actor=actor, actor_id_snapshot=actor.pk, course_id_snapshot=course.pk,
                               action="created" if creating else "updated", changed_fields=changes,
                               added_members=[{"id": str(pk), "role": role} for pk, role in additions.items()],
                               removed_members=[{"id": str(pk), "role": role} for pk, role in removals.items()])
    return JsonResponse({"course": managed_record(course)}, status=201 if creating else 200)


@endpoint(["GET", "POST"], management=True)
def management(request, actor):
    if request.method == "POST":
        return save(request, actor)
    courses, paging = paginated(request, Course.objects.all())
    return JsonResponse({"courses": [basic(course) for course in courses], **paging, "actor": user_data(actor), "csrfToken": get_token(request)})


@endpoint(["GET", "PATCH"], management=True)
def management_detail(request, actor, course_id):
    course = Course.objects.get(pk=course_id)
    return save(request, actor, course) if request.method == "PATCH" else JsonResponse({"course": managed_record(course)})


def belonging(actor):
    return Membership.objects.filter(VALID_MEMBERS, user=actor)


@endpoint(["GET"])
def mine(request, actor):
    courses, paging = paginated(request, Course.objects.filter(pk__in=belonging(actor).values("course_id")))
    return JsonResponse({"courses": [basic(course) for course in courses], **paging, "actor": user_data(actor), "csrfToken": get_token(request)})


@endpoint(["GET"])
def my_detail(request, actor, course_id):
    membership = belonging(actor).filter(course_id=course_id).select_related("course").first()
    if not membership:
        raise Course.DoesNotExist
    data = {**basic(membership.course), "myRole": membership.role}
    if membership.role == "docente":
        data["members"] = [member_record(member, False) for member in membership.course.memberships.filter(VALID_MEMBERS).select_related("user").order_by("user__username")]
    # Alumnos: ni lista, ni conteo, ni UUID/alias de otros alumnos.
    return JsonResponse({"course": data})
