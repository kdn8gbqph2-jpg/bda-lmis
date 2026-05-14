from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('target_type', models.CharField(
                    choices=[('patta', 'Patta'), ('colony', 'Colony'), ('plot', 'Plot')],
                    db_index=True, max_length=20,
                    help_text='Model the change applies to.',
                )),
                ('target_id', models.IntegerField(
                    blank=True, null=True,
                    help_text='PK of the row being updated; null for create operations.',
                )),
                ('operation', models.CharField(
                    choices=[('create', 'Create'), ('update', 'Update')], max_length=10,
                )),
                ('payload', models.JSONField(
                    help_text='The exact serializer payload the staff member submitted.',
                )),
                ('status', models.CharField(
                    choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                    db_index=True, default='pending', max_length=10,
                )),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('request_notes', models.TextField(blank=True,
                    help_text='Optional note the staff member attached.')),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('resolution_notes', models.TextField(blank=True,
                    help_text="Admin/Super's reason on approve/reject.")),
                ('target_label', models.CharField(blank=True, max_length=255,
                    help_text='Best-effort display name (colony name / patta number / plot number).')),
                ('requested_by', models.ForeignKey(
                    on_delete=models.deletion.PROTECT,
                    related_name='change_requests_submitted',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('resolved_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=models.deletion.SET_NULL,
                    related_name='change_requests_resolved',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'approvals_changerequest',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='changerequest',
            index=models.Index(fields=['status', 'requested_at'], name='approvals_status_req_idx'),
        ),
        migrations.AddIndex(
            model_name='changerequest',
            index=models.Index(fields=['target_type', 'target_id'], name='approvals_target_idx'),
        ),
    ]
