from rest_framework import serializers
from .models import AuditLog


def _user_label(u):
    if not u:
        return None
    return u.get_full_name() or u.username or u.email


class AuditLogSerializer(serializers.ModelSerializer):
    user_email          = serializers.EmailField(source='user.email', read_only=True,
                                                  allow_null=True)
    user_name           = serializers.SerializerMethodField()
    # When this entry came from an approved ChangeRequest, expose the
    # original submitter so the Edit History UI can render
    # "Submitted by X · Approved by Y".
    submitted_by_name   = serializers.SerializerMethodField()
    change_request_id   = serializers.IntegerField(source='change_request.pk',
                                                    read_only=True, allow_null=True)

    def get_user_name(self, obj):
        return _user_label(obj.user) or 'System'

    def get_submitted_by_name(self, obj):
        return _user_label(obj.submitted_by)

    class Meta:
        model  = AuditLog
        fields = (
            'id', 'timestamp',
            'user', 'user_email', 'user_name',
            'submitted_by', 'submitted_by_name',
            'change_request', 'change_request_id',
            'entity_type', 'entity_id', 'action',
            'old_values', 'new_values',
            'ip_address', 'user_agent',
        )
