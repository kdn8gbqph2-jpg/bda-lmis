import csv
import io

from django.core.cache import cache
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import PlotFilter
from .models import Plot, PlotKhasraMapping
from .serializers import (
    PlotListSerializer,
    PlotDetailSerializer,
    PlotWriteSerializer,
    PlotGeoJSONSerializer,
)
from users.permissions import IsAdmin, IsStaffOrAbove


class PlotViewSet(viewsets.ModelViewSet):
    """
    GET    /api/plots/              list  (authenticated)
    POST   /api/plots/              create (staff+)
    GET    /api/plots/{id}/         detail
    PUT    /api/plots/{id}/         update (staff+)
    DELETE /api/plots/{id}/         soft-delete → status='cancelled' (admin)
    GET    /api/plots/{id}/pattas/  pattas covering this plot
    GET    /api/plots/{id}/documents/
    GET    /api/plots/{id}/history/
    POST   /api/plots/bulk-import/  CSV upload (admin)
    GET    /api/plots/geojson/      FeatureCollection (?colony=1&status=patta_ok)
    """

    queryset         = Plot.objects.select_related(
        'colony', 'primary_khasra', 'updated_by'
    ).prefetch_related('khasra_mappings__khasra').all()
    filterset_class  = PlotFilter
    search_fields    = ['plot_number']
    ordering_fields  = ['plot_number', 'area_sqm', 'status', 'type']
    ordering         = ['colony', 'plot_number']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ('create', 'update', 'partial_update', 'bulk_import'):
            return [IsAuthenticated(), IsStaffOrAbove()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return PlotListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return PlotWriteSerializer
        return PlotDetailSerializer

    # ── Soft-delete: set status to cancelled ─────────────────────────────────

    def destroy(self, request, *args, **kwargs):
        plot = self.get_object()
        plot.status     = 'cancelled'
        plot.updated_by = request.user
        plot.save(update_fields=['status', 'updated_by', 'updated_at'])
        self._bust_geojson_cache(plot.colony_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        self._bust_geojson_cache(instance.colony_id)

    def perform_create(self, serializer):
        instance = serializer.save(updated_by=self.request.user)
        self._bust_geojson_cache(instance.colony_id)

    @staticmethod
    def _bust_geojson_cache(colony_id):
        cache.delete(f'plots:geojson:colony:{colony_id}')
        cache.delete('plots:geojson:all')

    # ── /api/plots/{id}/pattas/ ───────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def pattas(self, request, pk=None):
        plot = self.get_object()
        try:
            from pattas.models import Patta, PlotPattaMapping
            from pattas.serializers import PattaListSerializer
            patta_ids = PlotPattaMapping.objects.filter(
                plot=plot
            ).values_list('patta_id', flat=True)
            pattas = Patta.objects.filter(id__in=patta_ids)
            return Response(PattaListSerializer(pattas, many=True).data)
        except Exception:
            return Response(
                {'detail': 'Pattas app not yet available.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ── /api/plots/{id}/documents/ ────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        plot = self.get_object()
        try:
            from documents.models import Document
            from documents.serializers import DocumentListSerializer
            docs = Document.objects.filter(linked_plot=plot)
            return Response(DocumentListSerializer(docs, many=True).data)
        except Exception:
            return Response(
                {'detail': 'Documents app not yet available.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    # ── /api/plots/{id}/history/ ──────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        plot = self.get_object()
        try:
            from audit.models import AuditLog
            logs = AuditLog.objects.filter(
                entity_type='plot', entity_id=plot.id
            ).order_by('-timestamp')[:50]
            from audit.serializers import AuditLogSerializer
            return Response(AuditLogSerializer(logs, many=True).data)
        except Exception:
            return Response([])

    # ── /api/plots/bulk-import/ ───────────────────────────────────────────────

    @action(
        detail=False, methods=['post'],
        url_path='bulk-import',
        parser_classes=[MultiPartParser, FormParser],
    )
    def bulk_import(self, request):
        """
        Accept a CSV file with columns:
        plot_number, colony_id, primary_khasra_id, type, area_sqy, status

        Returns: {created: N, updated: N, errors: [...]}
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'detail': 'No file provided. Send multipart field "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            decoded = csv_file.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response(
                {'detail': 'File must be UTF-8 encoded.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader  = csv.DictReader(io.StringIO(decoded))
        created = 0
        updated = 0
        errors  = []

        required_cols = {'plot_number', 'colony_id', 'primary_khasra_id', 'type', 'area_sqy'}
        if not required_cols.issubset(set(reader.fieldnames or [])):
            missing = required_cols - set(reader.fieldnames or [])
            return Response(
                {'detail': f'CSV missing required columns: {missing}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for i, row in enumerate(reader, start=2):   # row 1 = header
                try:
                    ser = PlotWriteSerializer(data={
                        'plot_number':       row['plot_number'].strip(),
                        'colony':            int(row['colony_id']),
                        'primary_khasra':    int(row['primary_khasra_id']),
                        'type':              row.get('type', 'Residential').strip(),
                        'area_sqy':          row['area_sqy'].strip() or None,
                        'status':            row.get('status', 'available').strip(),
                    })

                    existing = Plot.objects.filter(
                        plot_number=row['plot_number'].strip()
                    ).first()

                    if existing:
                        ser = PlotWriteSerializer(existing, data={
                            'plot_number':    row['plot_number'].strip(),
                            'colony':         int(row['colony_id']),
                            'primary_khasra': int(row['primary_khasra_id']),
                            'type':           row.get('type', 'Residential').strip(),
                            'area_sqy':       row['area_sqy'].strip() or None,
                            'status':         row.get('status', 'available').strip(),
                        })
                        if ser.is_valid():
                            ser.save(updated_by=request.user)
                            updated += 1
                        else:
                            errors.append({'row': i, 'errors': ser.errors})
                    else:
                        if ser.is_valid():
                            ser.save(updated_by=request.user)
                            created += 1
                        else:
                            errors.append({'row': i, 'errors': ser.errors})

                except Exception as exc:
                    errors.append({'row': i, 'errors': str(exc)})

        return Response({'created': created, 'updated': updated, 'errors': errors})

    # ── /api/plots/geojson/ ───────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='geojson')
    def geojson_all(self, request):
        """
        FeatureCollection of all plots.  Supports ?colony=1 and ?status=patta_ok
        via the standard filter.  Results cached per colony for 30 min.
        """
        colony_id = request.query_params.get('colony')
        st        = request.query_params.get('status')

        # Simple cache key (colony + status combo)
        cache_key = f'plots:geojson:colony:{colony_id or "all"}:status:{st or "all"}'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)

        qs   = self.filter_queryset(
            self.get_queryset().select_related('colony')
        )
        data = PlotGeoJSONSerializer.collection(qs)
        cache.set(cache_key, data, 60 * 30)   # 30 min TTL
        return Response(data)

    # ── /api/plots/{id}/geojson/ ──────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='geojson')
    def geojson(self, request, pk=None):
        plot = self.get_object()
        return Response(PlotGeoJSONSerializer.feature(plot))
