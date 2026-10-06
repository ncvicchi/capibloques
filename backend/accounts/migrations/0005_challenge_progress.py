from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_empty_favorites")]
    operations = [migrations.AddField(model_name="user", name="challenge_progress", field=models.JSONField(default=dict, blank=True))]
