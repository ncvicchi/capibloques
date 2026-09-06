from django.urls import include, path, re_path
from school import views as school
from courses import views as courses

from .views import live, ready

urlpatterns = [
    path("api/management/courses/", courses.management),
    path("api/management/courses/<uuid:course_id>/", courses.management_detail),
    path("api/courses/", courses.mine),
    path("api/courses/<uuid:course_id>/", courses.my_detail),
    path("api/school/", school.public),
    re_path(r"^api/school/logo/(?P<digest>[a-f0-9]{64})/$", school.logo),
    path("api/management/school/", school.manage),
    path("api/auth/", include("accounts.urls")),
    path("api/management/", include("accounts.management_urls")),
    path("api/health/live/", live, name="live"),
    path("api/health/ready/", ready, name="ready"),
]
