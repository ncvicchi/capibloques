from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]
    operations = [
        migrations.CreateModel(
            name="ManagementEvent",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("actor_id_snapshot", models.UUIDField()),
                ("target_id_snapshot", models.UUIDField()),
                ("action", models.CharField(max_length=32)),
                ("changed_fields", models.JSONField(default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("actor", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="management_actions", to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
