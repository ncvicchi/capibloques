"""Explicit local synthetic test mode. Never used by DEV or production.

SQLite verifies contracts, NOT PostgreSQL advisory locks/concurrency. The normal
test suite still runs on PostgreSQL in DEV. No installation secrets are read.
"""
import os
from pathlib import Path

if os.environ.get('CAPI_LOCAL_TESTS') != '1':
    raise RuntimeError('Local test settings require CAPI_LOCAL_TESTS=1')
os.environ['DJANGO_SECRET_KEY_FILE'] = str(Path(__file__))
os.environ['DB_PASSWORD_FILE'] = str(Path(__file__))
from .settings import *  # noqa: E402,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
ALLOWED_HOSTS = ['localhost', 'testserver']
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
ROOT_URLCONF = 'config.test_local_urls'
