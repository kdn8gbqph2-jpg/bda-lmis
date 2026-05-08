from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import PattaFilter
from .models import Patta, PlotPattaMapping, PattaVersion
from .serializers import (
    PattaListSerializer,
    PattaDetailSerializer,
    PattaWriteSerializer,
    PattaVersionSerializer,
)
from users.permissions import IsAdmin, IsStaffOrAbove


class PattaViewSet(viewsets.ModelViewSet):
    """
    GET    /api/pattas/                     list   (authenticated)
    POST   /api/pattas/                     create (staff+)
    GET    /api/pattas/{id}/                detail
    PUT    /api/pattas/{id}/                update (staff+)
    DELETE /api/pattas/{id}/                soft-delete → status='cancelled' (admin)
    GET    /api/pattas/{id}/versions/       version history
    POST   /api/pattas/{id}/link-document/  attach a document (staff+)
    GET    /api/pattas/{id}/plots/          all plots covered by this patta
    """

    queryset        = Patta.objects.select_related(
        'colony', 'document', 'superseded_by', 'updated_by'
    ).prefetch_related('plot_mappings__plot').all()
    filterset_class = PattaFilter
    search_fields   = ['patta_number', 'allottee_name']
    ordering_fields = ['patta_number', 'allottee_name', 'issue_date', 'status']
    ordering        = ['colony', 'patta_number']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ('create', 'update', 'partial_update', 'link_document'):
            return [IsAuthenticated(), IsStaffOrAbove()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return PattaListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return PattaWriteSerializer
        return PattaDetailSerializer

    # ── Soft-delete ───────────────────────────────────────────────────────────

    def destroy(self, request, *args, **kwargs):
        patta = self.get_object()
        patta.status     = 'cancelled'
        patta.updated_by = request.user
        patta.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._snapshot(patta, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        self._snapshot(instance, self.request.user)
        cache.delete(f'colony:{instance.colony_id}:stats')

    def perform_create(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        self._snapshot(instance, self.request.user)
        cache.delete(f'colony:{instance.colony_id}:stats')

    @staticmethod
    def _snapshot(patta, user):
        """Store a PattaVersion snapshot after every mutation."""
        import json
        from rest_framework.renderers import JSONRenderer
        snapshot = PattaDetailSerializer(patta).data
        try:
            raw = json.loads(JSONRenderer().render(snapshot))
        except Exception:
            raw = {}
        PattaVersion.objects.create(patta=patta, snapshot=raw, changed_by=user)

    # ── /api/pattas/{id}/versions/ ────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        patta    = self.get_object()
        versions = patta.versions.select_related('changed_by').order_by('-changed_at')[:20]
        return Response(PattaVersionSerializer(versions, many=True).data)

    # ── /api/pattas/{id}/link-document/ ──────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='link-document')
    def link_document(self, request, pk=None):
        patta       = self.get_object()
        document_id = request.data.get('document_id')
        if not document_id:
            return Response(
                {'detail': 'document_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from documents.models import Document
            doc = Document.objects.get(pk=document_id)
        except Exception:
            return Response(
                {'detail': 'Document not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        patta.document   = doc
        patta.updated_by = request.user
        patta.save(update_fields=['document', 'updated_by', 'updated_at'])
        return Response(PattaDetailSerializer(patta).data)

    # ── /api/pattas/{id}/plots/ ───────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def plots(self, request, pk=None):
        patta = self.get_object()
        try:
            from plots.models import Plot
            from plots.serializers import PlotListSerializer
            plot_ids = patta.plot_mappings.values_list('plot_id', flat=True)
            plots    = Plot.objects.filter(id__in=plot_ids).select_related(
                'colony', 'primary_khasra'
            )
            return Response(PlotListSerializer(plots, many=True).data)
        except Exception:
            return Response(
                {'detail': 'Plots app not yet available.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
