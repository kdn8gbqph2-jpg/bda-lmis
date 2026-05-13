"""
Drop the unused layout_application_date column from Colony.

The authority decided the date of application is not a useful KPI on
its own — the layout_approval_date already marks the decisive event.
Dropping the column removes a piece of state nobody was maintaining.

Data loss is intentional and limited: a 1-question scan of existing
rows on production showed the column was effectively empty.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('colonies', '0008_rename_suo_moto_label'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='colony',
            name='layout_application_date',
        ),
    ]
