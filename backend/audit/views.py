from django_filters import FilterSet, CharFilter, NumberFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics

from .models import AuditLog
from .serializers import AuditLogSerializer
from users.permissions import IsAdmin


class AuditLogFilter(FilterSet):
    user_id     = NumberFilter(field_name='user_id')
    entity_type = CharFilter(lookup_expr='iexact')
    entity_id   = NumberFilter()
    action      = CharFilter(lookup_expr='iexact')

    class Meta:
        model  = AuditLog
        fields = ['user_id', 'entity_type', 'entity_id', 'action']


class AuditLogListView(generics.ListAPIView):
    """
    GET /api/audit-logs/   admin only, read-only

    Query params:
      user_id, entity_type, entity_id, action
      ordering: timestamp (default -timestamp)
    """
    queryset         = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes  = [IsAuthenticated, IsAdmin]
    filterset_class  = AuditLogFilter
    ordering_fields  = ['timestamp', 'entity_type', 'action']
    ordering         = ['-timestamp']
