from django.urls import path
from . import management_api
from . import deletion

urlpatterns = [
    path("users/", management_api.users),
    path("users/<uuid:user_id>/", management_api.detail),
    path("users/<uuid:user_id>/password/", management_api.reset_password),
    path("users/<uuid:user_id>/deletion/", deletion.deletion),
    path("users/<uuid:user_id>/deletion/backup/", deletion.backup),
]
