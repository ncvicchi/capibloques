"""Base de desarrollo privada; no es una configuración de producción."""
import os
from pathlib import Path

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


SECRET_KEY = read_secret("DJANGO_SECRET_KEY_FILE")
DEBUG = False
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "api"]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# Modelo propio desde la primera migración de identidad; sin Django admin público.
INSTALLED_APPS = ["django.contrib.contenttypes", "django.contrib.auth", "django.contrib.sessions", "accounts", "school", "courses"]
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
    "django.middleware.security.SecurityMiddleware",
    "school.middleware.SchoolUploadLimit",
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
# Sólo HTTP en localhost mediante SSH. HTTPS/cookies Secure se activarán antes
# de publicar; no confiar en X-Forwarded-* enviados por clientes.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
}
