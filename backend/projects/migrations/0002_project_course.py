import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("projects", "0001_initial"), ("courses", "0001_initial")]
    operations = [migrations.AddField(model_name="project", name="course", field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="projects", to="courses.course"))]
