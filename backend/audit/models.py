from django.db import models


class AuditLog(models.Model):
    user = models.ForeignKey(
        'users.CustomUser', null=True, on_delete=models.SET_NULL, related_name='audit_logs'
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
