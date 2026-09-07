from django.urls import include, path, re_path
from school import views as school
from courses import views as courses
from projects import views as projects

from .views import live, ready

urlpatterns = [
    path("api/projects/", projects.collection),
    path("api/projects/<uuid:project_id>/", projects.detail),
    path("api/projects/<uuid:project_id>/rename/", projects.action, {"action": "rename"}),
    path("api/projects/<uuid:project_id>/trash/", projects.action, {"action": "trash"}),
    path("api/projects/<uuid:project_id>/restore/", projects.action, {"action": "restore"}),
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
