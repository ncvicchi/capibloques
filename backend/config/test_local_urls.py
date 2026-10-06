"""Focused local contracts; the normal PostgreSQL suite uses config.urls."""
from django.urls import path
from courses import challenges
from accounts import deletion

urlpatterns = [
    path('api/challenges/', challenges.catalog),
    path('api/challenges/progress/', challenges.progress),
    path('api/challenges/courses/<uuid:course_id>/', challenges.edit),
    path('api/challenges/courses/<uuid:course_id>/progress/', challenges.overview),
    path('api/management/users/<uuid:user_id>/deletion/', deletion.deletion),
]
