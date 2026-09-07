"""Preferencias personales, sin cambiar identidad, roles o sesión."""
import json
from pathlib import Path

from django.contrib.auth import logout
from django.core.exceptions import RequestDataTooBig
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_http_methods

from .models import AccessEvent, User, access_lock
from .security import require_account

CATALOG = json.loads(Path(__file__).with_name("preferences_catalog.json").read_text(encoding="utf-8"))
AVATARS = {item["id"] for item in CATALOG["avatars"]}
BLOCKS = {item["type"] for item in CATALOG["blocks"]}


def avatar_id(user):
    return user.avatar_id if user.avatar_id in AVATARS else "capybara"


def record(user):
    stored = user.favorite_blocks if isinstance(user.favorite_blocks, list) else []
    return {"avatarId": avatar_id(user), "favorites": list(dict.fromkeys(item for item in stored if isinstance(item, str) and item in BLOCKS)),
            "version": user.preference_version, "configured": user.preferences_configured}


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError
        result[key] = value
    return result


@never_cache
@require_http_methods(["GET", "PATCH"])
@require_account()
def preferences(request):
    with access_lock():
        actor = User.objects.filter(pk=request.user.pk).first()
        if not actor or not actor.is_active or actor.session_epoch != request.user.session_epoch:
            logout(request)
            return JsonResponse({"code": "login_required", "error": "Tu sesión cambió. Volvé a ingresar."}, status=401)
        if actor.must_change_password:
            return JsonResponse({"code": "password_change_required", "error": "Elegí primero tu contraseña definitiva."}, status=403)
        if request.headers.get("X-Capi-Account") != str(actor.pk):
            return JsonResponse({"code": "account_changed", "error": "La cuenta de esta pestaña cambió. Volvé a ingresar."}, status=409)
        if request.method == "PATCH":
            try:
                if request.content_type != "application/json" or len(request.body) > 4096:
                    raise ValueError
                data = json.loads(request.body, object_pairs_hook=unique_object, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
                if (not isinstance(data, dict) or "version" not in data or type(data["version"]) is not int
                        or data["version"] < 1 or not 2 <= len(data) <= 3
                        or not set(data) <= {"version", "avatarId", "favorites"}):
                    raise ValueError
                if "avatarId" in data and (not isinstance(data["avatarId"], str) or data["avatarId"] not in AVATARS):
                    raise ValueError
                if "favorites" in data:
                    favorites = data["favorites"]
                    if (not isinstance(favorites, list) or len(favorites) > len(BLOCKS)
                            or any(not isinstance(item, str) or item not in BLOCKS for item in favorites)
                            or len(set(favorites)) != len(favorites)):
                        raise ValueError
            except (ValueError, UnicodeError, RecursionError, RequestDataTooBig):
                return JsonResponse({"code": "invalid_input", "error": "Elegí un avatar o bloques del catálogo. No se guardaron cambios."}, status=400)
            current = record(actor)
            same = all(current[key] == value for key, value in data.items() if key != "version")
            if data["version"] != actor.preference_version and (not same or data["version"] > actor.preference_version):
                return JsonResponse({"code": "stale_revision", "error": "Tus preferencias cambiaron en otra pestaña. Conservamos tu selección; revisá lo guardado antes de reemplazarlo.",
                                     "preferences": current, "csrfToken": get_token(request)}, status=409)
            changed = []
            for key, field in (("avatarId", "avatar_id"), ("favorites", "favorite_blocks")):
                if key in data and current[key] != data[key]:
                    setattr(actor, field, data[key])
                    changed.append(field)
            if "avatarId" in data and not actor.preferences_configured:
                actor.preferences_configured = True
                changed.append("preferences_configured")
            if changed:
                actor.preference_version += 1
                actor.save(update_fields=changed + ["preference_version"])
                AccessEvent.objects.create(user=actor, action="preferences_changed")
        return JsonResponse({"preferences": record(actor), "csrfToken": get_token(request)})
