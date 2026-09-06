"""ABM propio; sólo administradores. No expone Django admin ni proyectos ajenos."""
import json
from functools import wraps

from django.contrib.auth import logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import RequestDataTooBig, ValidationError
from django.db import IntegrityError
from django.db.models import Q
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.crypto import constant_time_compare, salted_hmac
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_http_methods

from .models import ManagementEvent, User, access_lock, normalize_alias
from .security import require_account
from .views import user_data


def fail(message, code="invalid_input", status=400):
    return JsonResponse({"error": message, "code": code}, status=status)


def record(user):
    data = {**user_data(user), "isActive": user.is_active, "createdAt": user.date_joined.isoformat()}
    data["version"] = salted_hmac("capibloques.account-version", json.dumps(data, sort_keys=True) + str(user.session_epoch), algorithm="sha256").hexdigest()
    return data


def endpoint(methods):
    def decorate(view):
        @wraps(view)
        def checked(request, *args, **kwargs):
            try:
                return view(request, *args, **kwargs)
            except User.DoesNotExist:
                return fail("La cuenta ya no existe. Actualizá el listado.", "not_found", 404)
            except ValidationError as error:
                return fail(" ".join(error.messages))
            except IntegrityError:
                return fail("Ese alias ya está en uso o los roles no son válidos.", "account_conflict", 409)
        return never_cache(require_http_methods(methods)(require_account("administrador")(sensitive_post_parameters()(checked))))
    return decorate


def body(request, fields):
    try:
        if request.content_type != "application/json" or len(request.body) > 4096:
            raise ValueError
        data = json.loads(request.body)
        if not isinstance(data, dict) or set(data) != set(fields):
            raise ValueError
        return data
    except (ValueError, UnicodeError, RequestDataTooBig):
        raise ValidationError("Revisá los campos del formulario.") from None


def text_field(data, name, maximum=256):
    value = data[name]
    if not isinstance(value, str) or not value or len(value) > maximum:
        raise ValidationError(f"El campo {name} no es válido.")
    return value


def assign_profile(user, data):
    user.username = normalize_alias(text_field(data, "alias", 32))
    user.display_name = text_field(data, "displayName", 80).strip()
    roles = data["roles"]
    valid = [["alumno"], ["docente"], ["administrador"], ["administrador", "docente"]]
    if not isinstance(roles, list) or any(not isinstance(role, str) for role in roles) or sorted(roles) not in valid:
        raise ValidationError("Elegí alumno, docente, administrador o administrador y docente.")
    if type(data["isActive"]) is not bool:
        raise ValidationError("El estado de la cuenta no es válido.")
    user.is_administrator = "administrador" in roles
    user.is_teacher = "docente" in roles
    user.is_student = "alumno" in roles
    user.is_active = data["isActive"]
    user.clean()


def set_temporary_password(user, data):
    password = text_field(data, "temporaryPassword")
    if password != text_field(data, "confirmation"):
        raise ValidationError("Las contraseñas no coinciden.")
    validate_password(password, user)
    user.set_password(password)
    user.must_change_password = True


def locked_actor(request):
    # Llamar DENTRO de access_lock: un permiso leído antes de esperar no autoriza
    # una escritura si el actor fue desactivado/degradado mientras tanto.
    actor = User.objects.filter(pk=request.user.pk).first()
    if not actor or not actor.is_active or actor.session_epoch != request.user.session_epoch:
        logout(request)
        return None
    if actor.must_change_password or not actor.is_administrator:
        return None
    return actor


def check_version(user, data):
    if not constant_time_compare(text_field(data, "version", 64), record(user)["version"]):
        return fail("La cuenta cambió en otra pestaña. Cancelá y volvé a abrirla antes de guardar.", "stale_version", 409)
    return None


def audit(actor, target, action, fields=()):
    ManagementEvent.objects.create(actor=actor, actor_id_snapshot=actor.pk, target_id_snapshot=target.pk, action=action, changed_fields=list(fields))


def finish(request, actor, target, **extra):
    ended = actor.pk == target.pk and target.session_epoch != request.user.session_epoch
    if ended:
        logout(request)
    return JsonResponse({"user": record(target), "sessionEnded": ended, **extra})


PROFILE = {"alias", "displayName", "roles", "isActive"}


@endpoint(["GET", "POST"])
def users(request):
    if request.method == "GET":
        query = request.GET.get("q", "").strip()
        role, active = request.GET.get("role", ""), request.GET.get("active", "")
        if len(query) > 80 or role not in ("", "alumno", "docente", "administrador") or active not in ("", "true", "false"):
            return fail("Los filtros no son válidos.")
        try:
            page = int(request.GET.get("page", "1"))
            if not 1 <= page <= 100000:
                raise ValueError
        except ValueError:
            return fail("La página no es válida.")
        results = User.objects.all()
        if query:
            results = results.filter(Q(username__icontains=query) | Q(display_name__icontains=query))
        if role:
            results = results.filter(**{{"alumno": "is_student", "docente": "is_teacher", "administrador": "is_administrator"}[role]: True})
        if active:
            results = results.filter(is_active=active == "true")
        count = results.count()
        page = min(page, max(1, (count + 19) // 20))
        return JsonResponse({"users": [record(user) for user in results.order_by("username", "id")[(page - 1) * 20:page * 20]],
                             "count": count, "page": page, "pageSize": 20, "actor": user_data(request.user), "csrfToken": get_token(request)})
    data = body(request, PROFILE | {"temporaryPassword", "confirmation"})
    with access_lock():
        actor = locked_actor(request)
        if not actor:
            return fail("Tu acceso cambió. Ingresá nuevamente.", "login_required", 401)
        target = User()
        assign_profile(target, data)
        set_temporary_password(target, data)
        target.save()
        audit(actor, target, "created", sorted(PROFILE))
        return JsonResponse({"user": record(target), "sessionEnded": False}, status=201)


@endpoint(["GET", "PATCH", "DELETE"])
def detail(request, user_id):
    if request.method == "GET":
        return JsonResponse({"user": record(User.objects.get(pk=user_id))})
    data = body(request, PROFILE | {"version"} if request.method == "PATCH" else {"version", "confirmationAlias", "understandsLocalDrafts"})
    with access_lock():
        actor = locked_actor(request)
        if not actor:
            return fail("Tu acceso cambió. Ingresá nuevamente.", "login_required", 401)
        target = User.objects.get(pk=user_id)
        conflict = check_version(target, data)
        if conflict is not None:
            return conflict
        if request.method == "PATCH":
            before = record(target)
            assign_profile(target, data)
            target.save(update_fields=["username", "display_name", "is_administrator", "is_teacher", "is_student", "is_active"])
            after = record(target)
            audit(actor, target, "updated", [field for field in sorted(PROFILE) if before[field] != after[field]])
            return finish(request, actor, target)
        if text_field(data, "confirmationAlias", 32) != target.username or data["understandsLocalDrafts"] is not True:
            return fail("Confirmá el alias exacto y la advertencia sobre los borradores locales.")
        # Hasta la fase 3 no existen proyectos en servidor. No inspeccionar ni
        # prometer respaldar localStorage ajeno; revisar esta baja al agregar datos.
        audit(actor, target, "deleted")
        self_deleted = actor.pk == target.pk
        target.delete()  # Método protegido; nunca QuerySet.delete().
        if self_deleted:
            logout(request)
        return JsonResponse({"deleted": True, "sessionEnded": self_deleted})


@endpoint(["POST"])
def reset_password(request, user_id):
    data = body(request, {"version", "temporaryPassword", "confirmation"})
    with access_lock():
        actor = locked_actor(request)
        if not actor:
            return fail("Tu acceso cambió. Ingresá nuevamente.", "login_required", 401)
        target = User.objects.get(pk=user_id)
        conflict = check_version(target, data)
        if conflict is not None:
            return conflict
        set_temporary_password(target, data)
        target.save(update_fields=["password", "must_change_password"])
        audit(actor, target, "password_reset")
        return finish(request, actor, target)
