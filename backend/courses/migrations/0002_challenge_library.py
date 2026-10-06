from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("courses", "0001_initial")]
    operations = [migrations.AddField(model_name="course", name="challenge_library", field=models.JSONField(default=dict, blank=True))]
