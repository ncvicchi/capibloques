"""Base de desarrollo privada; no es una configuración de producción."""
import ipaddress
import os
from pathlib import Path
from urllib.parse import urlsplit

from django.core.exceptions import ImproperlyConfigured


def read_secret(variable):
    """Obligatorio, sin valores por defecto ni contenido sensible en errores."""
    path = os.environ.get(variable)
    if not path:
        raise ImproperlyConfigured(f"Falta configurar {variable}")
    try:
        value = Path(path).read_text(encoding="utf-8").strip()
    except OSError:
        raise ImproperlyConfigured(f"No se pudo leer {variable}") from None
    if len(value) < 64:
        raise ImproperlyConfigured(f"Secreto inválido en {variable}")
    return value


def read_csv(variable, default=()):
    """Lee una lista explícita sin aceptar entradas vacías ni duplicadas."""
    raw = os.environ.get(variable)
    if raw is None:
        return tuple(default)
    if not raw.strip():
        return ()
    values = tuple(part.strip() for part in raw.split(","))
    if any(not value for value in values) or len(set(values)) != len(values):
        raise ImproperlyConfigured(f"Lista inválida en {variable}")
    return values


def read_bool(variable, default=False):
    raw = os.environ.get(variable)
    if raw is None:
        return default
    values = {"true": True, "false": False, "1": True, "0": False}
    try:
        return values[raw.strip().lower()]
    except KeyError:
        raise ImproperlyConfigured(f"Booleano inválido en {variable}") from None


def read_allowed_hosts(variable):
    hosts = read_csv(variable)
    for host in hosts:
        # Esta instalación usa nombres exactos: no permitir comodines, esquemas,
        # rutas, puertos ni variantes ambiguas dentro del valor de Host.
        if (host != host.lower() or host.endswith(".") or host == "*" or host.startswith(".") or "://" in host
                or any(character in host for character in "/?#@:") or any(character.isspace() for character in host)):
            raise ImproperlyConfigured(f"Host inválido en {variable}")
    return hosts


def read_https_origins(variable):
    origins = read_csv(variable)
    for origin in origins:
        parsed = urlsplit(origin)
        try:
            parsed.port
        except ValueError:
            raise ImproperlyConfigured(f"Origen HTTPS inválido en {variable}") from None
        if (origin != origin.lower() or parsed.scheme != "https" or not parsed.hostname
                or parsed.hostname.endswith(".") or "*" in parsed.hostname
                or parsed.hostname.startswith(".") or parsed.username or parsed.password
                or parsed.path or parsed.query or parsed.fragment):
            raise ImproperlyConfigured(f"Origen HTTPS inválido en {variable}")
    return origins


def read_proxy_ips(variable):
    values = read_csv(variable)
    try:
        # Canonizar para que distintas escrituras de IPv6 no creen identidades
        # diferentes. No se aceptan rangos: cada salto debe estar identificado.
        addresses = tuple(str(ipaddress.ip_address(value)) for value in values)
    except ValueError:
        raise ImproperlyConfigured(f"IP de proxy inválida en {variable}") from None
    if len(set(addresses)) != len(addresses):
        raise ImproperlyConfigured(f"IP de proxy duplicada en {variable}")
    return frozenset(addresses)


def validate_public_https(external_hosts, https_hosts, trusted_proxies, secure_cookies):
    """Valida como una unidad la superficie pública declarada por entorno."""
    if not secure_cookies:
        return
    if not https_hosts or not trusted_proxies:
        raise ImproperlyConfigured("La entrada HTTPS requiere origen y proxy explícitos")
    if frozenset(external_hosts) != frozenset(https_hosts):
        raise ImproperlyConfigured("Los hosts externos y HTTPS deben coincidir exactamente")


SECRET_KEY = read_secret("DJANGO_SECRET_KEY_FILE")
DEBUG = False
CAPIBLOQUES_LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "api"})
CAPIBLOQUES_EXTERNAL_HOSTS = frozenset(read_allowed_hosts("CAPIBLOQUES_ALLOWED_HOSTS"))
if CAPIBLOQUES_LOCAL_HOSTS.intersection(CAPIBLOQUES_EXTERNAL_HOSTS):
    raise ImproperlyConfigured("CAPIBLOQUES_ALLOWED_HOSTS sólo admite hosts externos")
ALLOWED_HOSTS = [*sorted(CAPIBLOQUES_LOCAL_HOSTS), *sorted(CAPIBLOQUES_EXTERNAL_HOSTS)]
CSRF_TRUSTED_ORIGINS = list(read_https_origins("CAPIBLOQUES_CSRF_TRUSTED_ORIGINS"))
CAPIBLOQUES_TRUSTED_PROXY_IPS = read_proxy_ips("CAPIBLOQUES_TRUSTED_PROXY_IPS")
CAPIBLOQUES_SECURE_COOKIES = read_bool("CAPIBLOQUES_SECURE_COOKIES", False)
CAPIBLOQUES_HTTPS_HOSTS = frozenset(urlsplit(origin).hostname for origin in CSRF_TRUSTED_ORIGINS)
validate_public_https(
    CAPIBLOQUES_EXTERNAL_HOSTS,
    CAPIBLOQUES_HTTPS_HOSTS,
    CAPIBLOQUES_TRUSTED_PROXY_IPS,
    CAPIBLOQUES_SECURE_COOKIES,
)
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Modelo propio desde la primera migración de identidad; sin Django admin público.
INSTALLED_APPS = ["django.contrib.contenttypes", "django.contrib.auth", "django.contrib.sessions", "accounts", "school", "courses", "projects", "compiler"]
COMPILER_ARTIFACT_ROOT = os.environ.get("COMPILER_ARTIFACT_ROOT", "/artifacts")
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator", "OPTIONS": {"user_attributes": ["username", "display_name"]}},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
SESSION_COOKIE_AGE = 8 * 60 * 60
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
DATA_UPLOAD_MAX_MEMORY_SIZE = 16 * 1024
DATA_UPLOAD_MAX_NUMBER_FILES = 1
DATA_UPLOAD_MAX_NUMBER_FIELDS = 20
CSRF_FAILURE_VIEW = "accounts.views.csrf_failure"
MIDDLEWARE = [
    # Debe ejecutarse antes de SecurityMiddleware: elimina cualquier cabecera
    # interna inyectada y sólo vuelve a crearla para un peer permitido.
    "config.proxy.TrustedProxyHeadersMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # Ubicado dentro de SecurityMiddleware para que incluso el rechazo HTTP
    # reciba las cabeceras defensivas normales.
    "config.proxy.RequirePublicHttpsMiddleware",
    "school.middleware.SchoolUploadLimit",
    "projects.middleware.ProjectUploadLimit",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "capibloques",
        "USER": "capibloques",
        "PASSWORD": read_secret("DB_PASSWORD_FILE"),
        "HOST": "db",
        "PORT": "5432",
        "CONN_MAX_AGE": 0,
        "OPTIONS": {
            "connect_timeout": 3,
            "options": "-c statement_timeout=5000 -c lock_timeout=3000",
        },
    }
}
LANGUAGE_CODE = "es-ar"
TIME_ZONE = "UTC"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
# Django no tiene una opción global capaz de servir a la vez el HTTPS público y
# el túnel HTTP de recuperación. La frontera de proxy marca Secure las cookies
# emitidas en HTTPS; estos valores base mantienen funcional sólo a localhost.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
# Django sólo confía en la cabecera interna creada por TrustedProxyHeadersMiddleware,
# nunca en X-Forwarded-Proto recibido directamente. El Host sigue validándose
# contra ALLOWED_HOSTS y no se toma de X-Forwarded-Host.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_CAPIBLOQUES_TRUSTED_PROTO", "https")
USE_X_FORWARDED_HOST = False

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}
