import json
from functools import wraps

from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.sessions.models import Session as StoredSession
from django.core.exceptions import RequestDataTooBig, ValidationError
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.utils.crypto import salted_hmac
from django.views.decorators.cache import never_cache
from django.views.decorators.debug import sensitive_post_parameters
from django.views.decorators.http import require_GET, require_POST

from .models import AccessEvent, User, access_lock, normalize_alias
from .security import consume_attempt, require_account


def csrf_failure(request, reason=""):
    return JsonResponse({"error": "La sesión de esta página cambió. Volvé a cargarla e intentá de nuevo.", "code": "csrf_failed"}, status=403)


def user_data(user):
    if not user.is_authenticated:
        return None
    from .preferences import avatar_id
    return {"id": str(user.pk), "alias": user.username, "displayName": user.display_name, "avatarId": avatar_id(user),
            "roles": user.roles, "mustChangePassword": user.must_change_password}


def json_body(fields):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            try:
                if request.content_type != "application/json" or len(request.body) > 4096:
                    raise ValueError
                data = json.loads(request.body)
                if not isinstance(data, dict) or set(data) != set(fields):
                    raise ValueError
                if any(not isinstance(value, str) or len(value) > 256 for value in data.values()):
                    raise ValueError
            except (ValueError, UnicodeError, RequestDataTooBig):
                return JsonResponse({"error": "Revisá los campos del formulario.", "code": "invalid_input"}, status=400)
            return view(request, data, *args, **kwargs)
        return wrapped
    return decorator


@never_cache
@require_GET
def session(request):
    return JsonResponse({"user": user_data(request.user), "csrfToken": get_token(request)})


@never_cache
@require_GET
@require_account()
def editor_session(request):
    # Identifica un ciclo de sesión sin exponer la cookie ni el hash de acceso.
    # No es una credencial: todas las peticiones siguen autenticándose en Django.
    context = salted_hmac("capibloques.editor-context",
                          f"{request.session.session_key}:{request.user.session_epoch}").hexdigest()
    expires = StoredSession.objects.filter(session_key=request.session.session_key).values_list("expire_date", flat=True).first()
    return JsonResponse({"user": user_data(request.user), "csrfToken": get_token(request), "context": context,
                         "expiresAt": expires.isoformat() if expires else None})


@never_cache
@require_POST
@sensitive_post_parameters()
@json_body(["alias", "password"])
def sign_in(request, data):
    try:
        alias = normalize_alias(data["alias"])
    except ValidationError:
        alias = None
    # REMOTE_ADDR sólo; no aceptar un X-Forwarded-For elegido por el cliente.
    # En DEV Vite agrupa clientes por su IP de proxy; documentado, no límite de PRD.
    if not consume_attempt("ip", request.META.get("REMOTE_ADDR", "unknown"), 120) or not consume_attempt("alias", alias or "<invalid>", 8):
        response = JsonResponse({"error": "Hubo muchos intentos. Esperá 5 minutos y volvé a intentar.", "code": "too_many_attempts"}, status=429)
        response["Retry-After"] = "300"
        return response
    user = authenticate(request, username=alias, password=data["password"]) if alias else None
    if alias is None:
        User().set_password(data["password"])  # Mismo trabajo de hash que un alias inexistente.
    if user is None:
        return JsonResponse({"error": "No pudimos ingresar con esos datos. Revisá tu alias y contraseña.", "code": "invalid_credentials"}, status=401)
    login(request, user)
    AccessEvent.objects.create(user=user, action="login")
    return JsonResponse({"user": user_data(user), "csrfToken": get_token(request)})


@never_cache
@require_POST
def sign_out(request):
    if request.user.is_authenticated and request.headers.get("X-Capi-Account", str(request.user.pk)) != str(request.user.pk):
        return JsonResponse({"error": "La cuenta cambió. Revisá quién está conectado.", "code": "account_changed"}, status=409)
    if request.user.is_authenticated:
        AccessEvent.objects.create(user=request.user, action="logout")
    logout(request)
    return JsonResponse({"user": None, "csrfToken": get_token(request)})


@never_cache
@require_POST
@require_account(allow_password_change=True)
@sensitive_post_parameters()
@json_body(["currentPassword", "newPassword", "confirmation"])
def change_password(request, data):
    if not consume_attempt("password", str(request.user.pk), 8):
        return JsonResponse({"error": "Esperá 5 minutos antes de volver a intentar.", "code": "too_many_attempts"}, status=429)
    with access_lock():
        user = User.objects.get(pk=request.user.pk)
        # Revalidar dentro de la transacción por si el acceso cambió mientras llegaba la petición.
        if not user.is_active or user.session_epoch != request.user.session_epoch:
            logout(request)
            return JsonResponse({"error": "Ingresá nuevamente.", "code": "login_required"}, status=401)
        if not user.check_password(data["currentPassword"]):
            return JsonResponse({"error": "La contraseña actual no coincide.", "code": "invalid_password"}, status=400)
        if data["newPassword"] != data["confirmation"]:
            return JsonResponse({"error": "Las contraseñas nuevas no coinciden.", "code": "password_mismatch"}, status=400)
        if data["newPassword"] == data["currentPassword"]:
            return JsonResponse({"error": "Elegí una contraseña distinta de la actual.", "code": "invalid_password"}, status=400)
        try:
            validate_password(data["newPassword"], user)
        except ValidationError as error:
            return JsonResponse({"error": " ".join(error.messages), "code": "invalid_password"}, status=400)
        user.set_password(data["newPassword"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        AccessEvent.objects.create(user=user, action="password_changed")
        update_session_auth_hash(request, user)
    return JsonResponse({"user": user_data(user), "csrfToken": get_token(request)})


@never_cache
@require_POST
@require_account(allow_password_change=True)
def sign_out_all(request):
    if request.headers.get("X-Capi-Account", str(request.user.pk)) != str(request.user.pk):
        return JsonResponse({"error": "La cuenta cambió. Revisá quién está conectado.", "code": "account_changed"}, status=409)
    with access_lock():
        user = User.objects.get(pk=request.user.pk)
        if not user.is_active or user.session_epoch != request.user.session_epoch:
            return JsonResponse({"error": "Ingresá nuevamente.", "code": "login_required"}, status=401)
        user.session_epoch += 1
        user.save(update_fields=["session_epoch"])
        AccessEvent.objects.create(user=user, action="logout_all")
    logout(request)
    return JsonResponse({"user": None, "csrfToken": get_token(request)})
