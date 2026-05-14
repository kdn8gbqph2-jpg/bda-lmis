from rest_framework import serializers
from .models import ChangeRequest


class ChangeRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(read_only=True)
    resolved_by_name  = serializers.CharField(read_only=True)

    class Meta:
        model  = ChangeRequest
        fields = (
            'id',
            'target_type', 'target_id', 'target_label',
            'operation', 'status',
            'requested_by', 'requested_by_name', 'requested_at',
            'resolved_by',  'resolved_by_name',  'resolved_at',
            'resolution_notes',
        )


class ChangeRequestDetailSerializer(ChangeRequestListSerializer):
    class Meta(ChangeRequestListSerializer.Meta):
        fields = ChangeRequestListSerializer.Meta.fields + (
            'payload', 'request_notes',
        )
