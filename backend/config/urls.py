from django.urls import include, path

from .views import live, ready

urlpatterns = [
    path("api/auth/", include("accounts.urls")),
    path("api/management/", include("accounts.management_urls")),
    path("api/health/live/", live, name="live"),
    path("api/health/ready/", ready, name="ready"),
]
