import hashlib
import uuid

from django.core.exceptions import RequestDataTooBig, TooManyFieldsSent, TooManyFilesSent, ValidationError
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET

from accounts.management_api import endpoint, fail, locked_actor
from accounts.models import access_lock
from accounts.views import user_data
from .images import normalize_logo
from .models import School, SchoolEvent


def public_data(school):
    return {"name": school.name if school else "", "logoUrl": f"/api/school/logo/{school.logo_digest}/" if school and school.logo_digest else None}


def configuration(request, school):
    return {"school": public_data(school), "version": str(school.version) if school else "unconfigured", "actor": user_data(request.user), "csrfToken": get_token(request)}


@never_cache
@require_GET
def public(request):
    return JsonResponse(public_data(School.objects.defer("logo").filter(pk=1).first()))


@never_cache
@require_GET
def logo(request, digest):
    school = School.objects.filter(pk=1, logo_digest=digest).only("logo").first()
    if not school or not school.logo:
        return HttpResponse(status=404)
    response = HttpResponse(bytes(school.logo), content_type="image/png")
    response["Content-Disposition"] = 'inline; filename="logo-colegio.png"'
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    response["Cross-Origin-Resource-Policy"] = "same-origin"
    return response


@endpoint(["GET", "POST"])
def manage(request):
    if request.method == "GET":
        return JsonResponse(configuration(request, School.objects.defer("logo").filter(pk=1).first()))
    if request.content_type != "multipart/form-data":
        return fail("Usá el formulario de colegio.", status=415)
    try:
        data, files = request.POST, request.FILES
        if set(data) != {"name", "version", "logoAction"} or any(len(data.getlist(key)) != 1 for key in data):
            raise ValidationError("Revisá los campos del formulario.")
        name, version, action = data["name"].strip(), data["version"], data["logoAction"]
        if not name or len(name) > 100 or any(ord(character) < 32 for character in name):
            raise ValidationError("El nombre del colegio debe tener entre 1 y 100 caracteres, en una sola línea.")
        if action not in ("keep", "remove", "replace") or len(version) > 40:
            raise ValidationError("La acción solicitada no es válida.")
        if set(files) != ({"logo"} if action == "replace" else set()) or any(len(files.getlist(key)) != 1 for key in files):
            raise ValidationError("Seleccioná exactamente un logo al reemplazarlo; si lo conservás o quitás, no adjuntes archivos.")
        # Valida antes de escribir; una imagen rechazada conserva nombre y logo.
        encoded = normalize_logo(files["logo"]) if action == "replace" else b""
    except (RequestDataTooBig, TooManyFieldsSent, TooManyFilesSent):
        return fail("La carga tiene demasiados datos.", status=413)
    with access_lock():
        actor = locked_actor(request)
        if not actor:
            return fail("Tu acceso cambió. Ingresá nuevamente.", "login_required", 401)
        school = School.objects.filter(pk=1).first()
        if version != (str(school.version) if school else "unconfigured"):
            return fail("Otro administrador cambió el colegio. Cancelá para cargar la versión actual antes de guardar.", "stale_version", 409)
        school = school or School()
        changed = []
        if school.name != name:
            school.name = name
            changed.append("name")
        if action != "keep":
            digest = hashlib.sha256(encoded).hexdigest() if encoded else ""
            if digest != school.logo_digest:
                school.logo, school.logo_digest = encoded, digest
                changed.append("logo")
        if changed:
            school.version = uuid.uuid4()
            school.save()
            SchoolEvent.objects.create(actor=actor, actor_id_snapshot=actor.pk, changed_fields=changed)
        return JsonResponse(configuration(request, school))
