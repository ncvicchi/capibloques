from django.urls import include, path, re_path
from school import views as school

from .views import live, ready

urlpatterns = [
    path("api/school/", school.public),
    re_path(r"^api/school/logo/(?P<digest>[a-f0-9]{64})/$", school.logo),
    path("api/management/school/", school.manage),
    path("api/auth/", include("accounts.urls")),
    path("api/management/", include("accounts.management_urls")),
    path("api/health/live/", live, name="live"),
    path("api/health/ready/", ready, name="ready"),
]
