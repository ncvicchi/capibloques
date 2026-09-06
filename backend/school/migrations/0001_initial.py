import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="School",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=100)),
                ("logo", models.BinaryField(default=bytes)),
                ("logo_digest", models.CharField(blank=True, max_length=64)),
                ("version", models.UUIDField(default=uuid.uuid4, editable=False)),
            ],
            options={"constraints": [models.CheckConstraint(condition=models.Q(id=1), name="school_singleton")]},
        ),
        migrations.CreateModel(
            name="SchoolEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id_snapshot", models.UUIDField()),
                ("changed_fields", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
