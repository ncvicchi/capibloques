from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("compiler", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="build",
            name="board_profile",
            field=models.CharField(default="wemos-d1-r32", max_length=64),
        ),
    ]
