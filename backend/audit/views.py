from django_filters import FilterSet, CharFilter, NumberFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics

from .models import AuditLog
from .serializers import AuditLogSerializer


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
    GET /api/audit-logs/   read-only

    Permissions:
      Admin / Superintendent → full read access (use for the Audit Logs
                               admin page).
      Staff / Viewer          → access only when the query scopes to a
                               specific entity (entity_type + entity_id),
                               so they can view the Edit History of a
                               record they're looking at but not browse
                               the entire system log.

    Query params:
      user_id, entity_type, entity_id, action
      ordering: timestamp (default -timestamp)
    """
    queryset            = AuditLog.objects.select_related(
        'user', 'submitted_by', 'change_request',
    ).all()
    serializer_class    = AuditLogSerializer
    permission_classes  = [IsAuthenticated]
    filterset_class     = AuditLogFilter
    ordering_fields     = ['timestamp', 'entity_type', 'action']
    ordering            = ['-timestamp']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        role = getattr(user, 'role', None)
        if role in ('admin', 'superintendent'):
            return qs
        # Non-resolvers must scope to a single record. Without both
        # filters set we return an empty queryset (a guarded 200 rather
        # than 403) so frontends that pre-fetch don't error.
        entity_type = self.request.query_params.get('entity_type')
        entity_id   = self.request.query_params.get('entity_id')
        if not entity_type or not entity_id:
            return qs.none()
        return qs
