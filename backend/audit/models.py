from django.db import models


class AuditLog(models.Model):
    user = models.ForeignKey(
        'users.CustomUser', null=True, on_delete=models.SET_NULL, related_name='audit_logs',
        help_text='Whoever made the save call against the model (the resolver '
                  'when this is an approved ChangeRequest; the actor themselves '
                  'for direct admin/staff writes).',
    )
    # Original submitter for approved ChangeRequest writes — the Staff
    # member who proposed the change before an Admin/Super approved it.
    # NULL for direct writes.
    submitted_by = models.ForeignKey(
        'users.CustomUser', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs_submitted',
        help_text='Staff submitter when this save was triggered by an '
                  'approved ChangeRequest; null otherwise.',
    )
    change_request = models.ForeignKey(
        'bda_approvals.ChangeRequest', null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs',
        help_text='ChangeRequest that produced this audit entry, if any.',
    )

    entity_type = models.CharField(max_length=50)
    entity_id = models.IntegerField(null=True)
    action = models.CharField(max_length=20)  # create | update | delete
    old_values = models.JSONField(null=True)
    new_values = models.JSONField(null=True)
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['user']),
        ]
        ordering = ['-timestamp']
