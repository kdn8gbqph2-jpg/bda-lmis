from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name='DmsFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('dms_number',          models.CharField(db_index=True, max_length=40, unique=True,
                                                          help_text='Barcode value from DMS — e.g. "BHR104945"')),
                ('file_number',         models.CharField(blank=True, max_length=255)),
                ('applicant_name',      models.CharField(blank=True, max_length=255)),
                ('scheme_name',         models.CharField(blank=True, max_length=255)),
                ('allottee_name',       models.CharField(blank=True, max_length=255)),
                ('location_path',       models.CharField(blank=True, max_length=500,
                                                          help_text='Filesystem path on the DMS scan drive (Windows-style).')),
                ('directory_name',      models.CharField(blank=True, max_length=255)),
                ('source_file_id',      models.IntegerField(blank=True, db_index=True, null=True,
                                                             help_text='filedetails.ID on the source DMS')),
                ('source_directory_id', models.IntegerField(blank=True, null=True,
                                                             help_text='filedirectories.ID on the source DMS')),
                ('source_created_at',   models.DateTimeField(blank=True, null=True,
                                                              help_text='filedetails.CreatedDateTime')),
                ('refreshed_at',        models.DateTimeField(auto_now=True,
                                                              help_text='Last time the sync touched this row')),
            ],
            options={
                'db_table': 'dms_sync_file',
                'ordering': ['dms_number'],
            },
        ),
        migrations.AddIndex(
            model_name='dmsfile',
            index=models.Index(fields=['file_number'],     name='dms_sync_fi_file_nu_8d1a01_idx'),
        ),
        migrations.AddIndex(
            model_name='dmsfile',
            index=models.Index(fields=['applicant_name'],  name='dms_sync_fi_applica_e1bc7e_idx'),
        ),
        migrations.CreateModel(
            name='DmsSyncRun',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('started_at',    models.DateTimeField(auto_now_add=True)),
                ('finished_at',   models.DateTimeField(blank=True, null=True)),
                ('status',        models.CharField(choices=[('ok', 'OK'), ('failed', 'Failed')],
                                                    default='ok', max_length=10)),
                ('rows_seen',     models.IntegerField(default=0,
                                                       help_text='Rows fetched from source DMS')),
                ('rows_inserted', models.IntegerField(default=0)),
                ('rows_updated',  models.IntegerField(default=0)),
                ('rows_skipped',  models.IntegerField(default=0,
                                                       help_text='Rows without a Barcode value')),
                ('error_message', models.TextField(blank=True)),
            ],
            options={
                'db_table': 'dms_sync_run',
                'ordering': ['-started_at'],
            },
        ),
    ]
