from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.cache import cache

from .models import Colony, Khasra
from .serializers import (
    ColonyListSerializer,
    ColonyDetailSerializer,
    ColonyGeoJSONSerializer,
    KhasraListSerializer,
    KhasraDetailSerializer,
    KhasraGeoJSONSerializer,
)
from .filters import ColonyFilter, KhasraFilter
from users.permissions import IsAdmin, IsStaffOrAbove


class ColonyViewSet(viewsets.ModelViewSet):
    """
    GET    /api/colonies/              list  (all authenticated)
    POST   /api/colonies/              create (admin only)
    GET    /api/colonies/{id}/         detail
    PUT    /api/colonies/{id}/         update (admin only)
    DELETE /api/colonies/{id}/         delete (admin only)
    GET    /api/colonies/{id}/stats/   aggregate stats
    GET    /api/colonies/{id}/geojson/ single boundary as GeoJSON Feature
    GET    /api/colonies/geojson/      all colonies as FeatureCollection
    """
    queryset         = Colony.objects.all()
    filterset_class  = ColonyFilter
    search_fields    = ['name', 'zone']
    ordering_fields  = ['name', 'zone', 'status']
    ordering         = ['name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return ColonyListSerializer
        return ColonyDetailSerializer

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
        cache.delete('colonies:all')
        cache.delete(f'colony:{serializer.instance.pk}:stats')

    def perform_create(self, serializer):
        serializer.save(updated_by=self.request.user)
        cache.delete('colonies:all')

    # ── /api/colonies/{id}/stats/ ─────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        colony     = self.get_object()
        cache_key  = f'colony:{colony.pk}:stats'
        cached     = cache.get(cache_key)
        if cached:
            return Response(cached)

        data = {
            'total_residential_plots': colony.total_residential_plots,
            'total_commercial_plots':  colony.total_commercial_plots,
            'total_plots':             colony.total_plots,
            'khasra_count':            colony.khasras.count(),
        }

        # Extended stats — available once plots/pattas apps are migrated
        try:
            from plots.models import Plot
            plot_qs    = Plot.objects.filter(colony=colony)
            data.update({
                'plots_patta_ok':      plot_qs.filter(status='patta_ok').count(),
                'plots_patta_missing': plot_qs.filter(status='patta_missing').count(),
                'plots_available':     plot_qs.filter(status='available').count(),
            })
        except Exception:
            pass

        try:
            from pattas.models import Patta
            patta_qs = Patta.objects.filter(colony=colony)
            data.update({
                'pattas_total':   patta_qs.count(),
                'pattas_issued':  patta_qs.filter(status='issued').count(),
                'pattas_missing': patta_qs.filter(status='missing').count(),
            })
        except Exception:
            pass

        cache.set(cache_key, data, 60 * 10)  # 10 min TTL
        return Response(data)

    # ── /api/colonies/{id}/geojson/ ───────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def geojson(self, request, pk=None):
        colony = self.get_object()
        return Response(ColonyGeoJSONSerializer.feature(colony))

    # ── /api/colonies/geojson/ ────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='geojson')
    def geojson_all(self, request):
        cached = cache.get('colonies:all:geojson')
        if cached:
            return Response(cached)
        qs   = self.filter_queryset(self.get_queryset())
        data = ColonyGeoJSONSerializer.collection(qs)
        cache.set('colonies:all:geojson', data, 60 * 60)  # 1 hr TTL
        return Response(data)


# ── Khasra ────────────────────────────────────────────────────────────────────

class KhasraViewSet(viewsets.ModelViewSet):
    """
    GET  /api/khasras/              ?colony=1
    GET  /api/khasras/{id}/
    GET  /api/khasras/{id}/geojson/
    GET  /api/khasras/{id}/plots/   (available once plots app is ready)
    """
    queryset        = Khasra.objects.select_related('colony').all()
    filterset_class = KhasraFilter
    ordering        = ['colony', 'number']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), IsAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return KhasraListSerializer
        return KhasraDetailSerializer

    # ── /api/khasras/{id}/geojson/ ────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def geojson(self, request, pk=None):
        khasra = self.get_object()
        return Response(KhasraGeoJSONSerializer.feature(khasra))

    # ── /api/khasras/{id}/plots/ ─────────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def plots(self, request, pk=None):
        khasra = self.get_object()
        try:
            from plots.models import Plot, PlotKhasraMapping
            # Plots whose primary khasra OR secondary khasra mapping matches
            primary_ids   = Plot.objects.filter(primary_khasra=khasra).values_list('id', flat=True)
            secondary_ids = PlotKhasraMapping.objects.filter(khasra=khasra).values_list('plot_id', flat=True)
            all_ids       = set(primary_ids) | set(secondary_ids)
            plots         = Plot.objects.filter(id__in=all_ids)
            from plots.serializers import PlotListSerializer
            return Response(PlotListSerializer(plots, many=True).data)
        except Exception:
            return Response(
                {'detail': 'Plots app not yet available.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
