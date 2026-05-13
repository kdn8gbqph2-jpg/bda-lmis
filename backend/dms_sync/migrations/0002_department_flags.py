from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bda_dms_sync', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='dmsfile',
            name='department_name',
            field=models.CharField(
                blank=True, db_index=True, max_length=60,
                help_text='Source masterdepartments.Name — required by DMS API to fetch the PDF.',
            ),
        ),
        migrations.AddField(
            model_name='dmsfile',
            name='has_ns',
            field=models.BooleanField(
                default=False,
                help_text='DMS reports a "newly scanned" PDF for this file.',
            ),
        ),
        migrations.AddField(
            model_name='dmsfile',
            name='has_cs',
            field=models.BooleanField(
                default=False,
                help_text='DMS reports a "classified scanned" PDF for this file.',
            ),
        ),
    ]
