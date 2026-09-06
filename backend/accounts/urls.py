from django.urls import path
from . import views

urlpatterns = [
    path("session/", views.session),
    path("editor-session/", views.editor_session),
    path("login/", views.sign_in),
    path("logout/", views.sign_out),
    path("password/", views.change_password),
    path("logout-all/", views.sign_out_all),
]
