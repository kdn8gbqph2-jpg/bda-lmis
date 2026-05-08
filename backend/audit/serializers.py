from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True,
                                        allow_null=True)
    user_name  = serializers.SerializerMethodField()

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.email
        return 'System'

    class Meta:
        model  = AuditLog
        fields = (
            'id', 'timestamp',
            'user', 'user_email', 'user_name',
            'entity_type', 'entity_id', 'action',
            'old_values', 'new_values',
            'ip_address', 'user_agent',
        )
