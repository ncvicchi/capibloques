from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_preferences")]
    operations = [
        migrations.AlterField(model_name="user", name="favorite_blocks", field=models.JSONField(default=list, blank=True)),
    ]
