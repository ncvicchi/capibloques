from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_managementevent")]
    operations = [
        migrations.AddField(model_name="user", name="avatar_id", field=models.CharField(default="capybara", max_length=32)),
        migrations.AddField(model_name="user", name="favorite_blocks", field=models.JSONField(default=list)),
        migrations.AddField(model_name="user", name="preference_version", field=models.PositiveIntegerField(default=1, editable=False)),
        migrations.AddField(model_name="user", name="preferences_configured", field=models.BooleanField(default=False)),
    ]
