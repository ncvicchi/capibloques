from datetime import timedelta
from functools import wraps

from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.crypto import salted_hmac

from .models import LoginBucket


def consume_attempt(scope, identity, limit):
    now = timezone.now()
    key = salted_hmac("capibloques.login." + scope, identity, algorithm="sha256").hexdigest()
    with transaction.atomic():
        LoginBucket.objects.get_or_create(key=key, defaults={"started_at": now})
        bucket = LoginBucket.objects.select_for_update().get(pk=key)
        if bucket.started_at <= now - timedelta(minutes=5):
            bucket.started_at, bucket.attempts = now, 0
        if bucket.attempts >= limit:
            return False
        bucket.attempts += 1
        bucket.save(update_fields=["started_at", "attempts"])
    LoginBucket.objects.filter(started_at__lt=now - timedelta(days=1)).delete()
    return True


def require_account(*roles, allow_password_change=False):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({"error": "Ingresá con tu alias y contraseña.", "code": "login_required"}, status=401)
            if request.user.must_change_password and not allow_password_change:
                return JsonResponse({"error": "Primero elegí una contraseña nueva.", "code": "password_change_required"}, status=403)
            if roles and not set(roles).intersection(request.user.roles):
                return JsonResponse({"error": "Tu cuenta no tiene permiso para esta acción.", "code": "forbidden"}, status=403)
            return view(request, *args, **kwargs)
        return wrapped
    return decorator
