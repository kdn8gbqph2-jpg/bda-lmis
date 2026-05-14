"""
AuditLog gains two new pointers so the Edit History UI can attribute
edits to both the original submitter and the resolver when a write
came in through the ChangeRequest queue.
"""
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0002_initial'),
        ('bda_approvals', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='submitted_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='audit_logs_submitted',
                to=settings.AUTH_USER_MODEL,
                help_text='Staff submitter when this save was triggered by an '
                          'approved ChangeRequest; null otherwise.',
            ),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='change_request',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='audit_logs',
                to='bda_approvals.changerequest',
                help_text='ChangeRequest that produced this audit entry, if any.',
            ),
        ),
    ]
