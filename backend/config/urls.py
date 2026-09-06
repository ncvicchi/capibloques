from django.urls import path

from .views import live, ready

urlpatterns = [
    path("api/health/live/", live, name="live"),
    path("api/health/ready/", ready, name="ready"),
]
