"""Frontera de confianza para el proxy inverso de CapiBloques."""
import ipaddress

from django.conf import settings
from django.http import JsonResponse
from django.http.request import split_domain_port


TRUSTED_PROTO_HEADER = "HTTP_X_CAPIBLOQUES_TRUSTED_PROTO"


def canonical_ip(value):
    try:
        return str(ipaddress.ip_address(value))
    except (TypeError, ValueError):
        return None


def resolve_client_ip(remote_addr, forwarded_for, trusted_proxies):
    """Obtiene el salto no confiable más cercano sin creerle al cliente directo."""
    peer = canonical_ip(remote_addr)
    if peer is None:
        return "unknown"
    trusted = {canonical_ip(value) for value in trusted_proxies}
    trusted.discard(None)
    if peer not in trusted or not forwarded_for:
        return peer
    if len(forwarded_for) > 1024:
        return peer

    parts = forwarded_for.split(",")
    if len(parts) > 16:
        return peer
    forwarded = [canonical_ip(part.strip()) for part in parts]
    if not forwarded or any(address is None for address in forwarded):
        # Una cadena mal formada no puede elegir otra identidad; se limita al
        # peer conocido y el borde debe corregirse antes de publicarse.
        return peer

    for address in reversed([*forwarded, peer]):
        if address not in trusted:
            return address
    return forwarded[0]


class TrustedProxyHeadersMiddleware:
    """Acepta esquema e IP reenviados sólo desde peers declarados."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # El cliente puede intentar enviar una cabecera con el mismo nombre;
        # siempre se elimina antes de calcular el esquema confiable.
        request.META.pop(TRUSTED_PROTO_HEADER, None)
        peer = canonical_ip(request.META.get("REMOTE_ADDR"))
        trusted = settings.CAPIBLOQUES_TRUSTED_PROXY_IPS
        forwarded_for = request.META.pop("HTTP_X_FORWARDED_FOR", None)
        forwarded_proto = request.META.pop("HTTP_X_FORWARDED_PROTO", "")
        request.capibloques_client_ip = resolve_client_ip(
            peer,
            forwarded_for,
            trusted,
        )
        if peer in trusted and forwarded_proto.strip().lower() == "https":
            request.META[TRUSTED_PROTO_HEADER] = "https"

        response = self.get_response(request)
        if settings.CAPIBLOQUES_SECURE_COOKIES and request.is_secure():
            for cookie_name in (settings.SESSION_COOKIE_NAME, settings.CSRF_COOKIE_NAME):
                if cookie_name in response.cookies:
                    response.cookies[cookie_name]["secure"] = True
        return response


class RequirePublicHttpsMiddleware:
    """Impide que el FQDN público cree una sesión si el borde perdió HTTPS."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host, _ = split_domain_port(request.META.get("HTTP_HOST", "").lower())
        if (settings.CAPIBLOQUES_SECURE_COOKIES and host in settings.CAPIBLOQUES_EXTERNAL_HOSTS
                and not request.is_secure()):
            response = JsonResponse(
                {"error": "Este sitio requiere una conexión segura.", "code": "https_required"},
                status=400,
            )
            response["Cache-Control"] = "no-store"
            return response
        return self.get_response(request)
