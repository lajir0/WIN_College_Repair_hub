from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("repairs", "0004_repairrequest_selection_workflow"),
    ]

    operations = [
        migrations.AddField(
            model_name="repairjob",
            name="client_removed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
