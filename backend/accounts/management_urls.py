from django.urls import path
from . import management_api

urlpatterns = [
    path("users/", management_api.users),
    path("users/<uuid:user_id>/", management_api.detail),
    path("users/<uuid:user_id>/password/", management_api.reset_password),
]
