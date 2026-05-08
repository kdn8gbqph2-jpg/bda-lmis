import os
import tempfile

from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomLayer, LayerFeature
from .serializers import (
    CustomLayerListSerializer,
    CustomLayerDetailSerializer,
    CustomLayerWriteSerializer,
    CustomLayerGeoJSONSerializer,
)
from users.permissions import IsAdmin, IsStaffOrAbove


# ── Custom layer CRUD ─────────────────────────────────────────────────────────

class CustomLayerViewSet(viewsets.ModelViewSet):
    """
    GET    /api/gis/custom-layers/              list
    POST   /api/gis/custom-layers/              upload GeoJSON or Shapefile ZIP (staff+)
    GET    /api/gis/custom-layers/{id}/
    PUT    /api/gis/custom-layers/{id}/         update style/metadata (staff+)
    DELETE /api/gis/custom-layers/{id}/         admin only
    GET    /api/gis/custom-layers/{id}/geojson/ FeatureCollection
    POST   /api/gis/custom-layers/{id}/validate/ dry-run parse check
    """
    queryset        = CustomLayer.objects.select_related('colony', 'created_by').all()
    ordering_fields = ['layer_type', 'name', 'created_at']
    ordering        = ['layer_type', 'name']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        if self.action in ('create', 'update', 'partial_update', 'validate'):
            return [IsAuthenticated(), IsStaffOrAbove()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomLayerListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return CustomLayerWriteSerializer
        return CustomLayerDetailSerializer

    def get_parsers(self):
        if self.action == 'create':
            return [MultiPartParser(), FormParser()]
        return super().get_parsers()

    def create(self, request, *args, **kwargs):
        """
        Accepts either:
          - multipart with `file` (GeoJSON or Shapefile ZIP) + metadata fields
          - JSON body (creates an empty layer; features added separately)
        """
        file = request.FILES.get('file')
        ser  = CustomLayerWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        layer = ser.save(created_by=request.user)

        if file:
            error = self._ingest_file(layer, file)
            if error:
                layer.delete()
                return Response({'detail': error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            CustomLayerDetailSerializer(layer).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        serializer.save()
        # Bust geojson cache for this layer
        cache.delete(f'gis:layer:{serializer.instance.pk}:geojson')

    # ── /api/gis/custom-layers/{id}/geojson/ ─────────────────────────────────

    @action(detail=True, methods=['get'])
    def geojson(self, request, pk=None):
        layer     = self.get_object()
        cache_key = f'gis:layer:{layer.pk}:geojson'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)
        data = CustomLayerGeoJSONSerializer.collection(layer)
        cache.set(cache_key, data, 60 * 60)  # 1 hr TTL
        return Response(data)

    # ── /api/gis/custom-layers/{id}/validate/ ────────────────────────────────

    @action(detail=False, methods=['post'], url_path='validate',
            parser_classes=[MultiPartParser, FormParser])
    def validate_file(self, request):
        """
        Dry-run parse — returns feature count + CRS without saving anything.
        """
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'detail': 'Send a GeoJSON or Shapefile ZIP in the "file" field.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = self._parse_file(file)
            return Response({
                'feature_count': len(result),
                'preview':       result[:3],   # first 3 feature properties
            })
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _ingest_file(layer: CustomLayer, file) -> str | None:
        """
        Parse file and create LayerFeature records.
        Returns an error string on failure, None on success.
        """
        try:
            features = CustomLayerViewSet._parse_file(file)
        except Exception as exc:
            return str(exc)

        from django.contrib.gis.geos import GeometryCollection
        geoms = []

        for feat in features:
            geom  = feat['geometry']
            props = feat['properties']
            LayerFeature.objects.create(
                custom_layer=layer,
                geometry=geom,
                properties=props,
            )
            geoms.append(geom)

        # Build a GeometryCollection for the layer-level geometry
        if geoms:
            layer.geometry     = GeometryCollection(*geoms, srid=4326)
            layer.source_file  = file.name
            layer.save(update_fields=['geometry', 'source_file', 'updated_at'])

        return None

    @staticmethod
    def _parse_file(file) -> list:
        """
        Returns list of {'geometry': <GEOSGeometry>, 'properties': dict}.
        Handles GeoJSON (.json/.geojson) and Shapefile ZIP (.zip).
        """
        name = file.name.lower()

        if name.endswith('.zip'):
            # Shapefile ZIP
            from .geo_utils import parse_shapefile_zip
            with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as tmp:
                for chunk in file.chunks():
                    tmp.write(chunk)
                tmp_path = tmp.name
            try:
                return parse_shapefile_zip(tmp_path)
            finally:
                os.unlink(tmp_path)

        elif name.endswith(('.json', '.geojson')):
            import json as _json
            from django.contrib.gis.geos import GEOSGeometry
            data     = _json.loads(file.read())
            features = []
            items    = data.get('features', [data]) if data.get('type') == 'FeatureCollection' else [data]
            for item in items:
                geom = GEOSGeometry(_json.dumps(item.get('geometry', item)), srid=4326)
                features.append({
                    'geometry':   geom,
                    'properties': item.get('properties', {}),
                })
            return features

        else:
            raise ValueError(
                f'Unsupported file type: {file.name}. Upload a .geojson or .zip (Shapefile).'
            )


# ── Proxy GeoJSON endpoints for colonies / khasras / plots ───────────────────

class ColonyGeoJSONView(APIView):
    """GET /api/gis/colonies/geojson/  — delegates to colonies app cache."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cached = cache.get('colonies:all:geojson')
        if cached:
            return Response(cached)
        from colonies.models import Colony
        from colonies.serializers import ColonyGeoJSONSerializer
        qs   = Colony.objects.all()
        data = ColonyGeoJSONSerializer.collection(qs)
        cache.set('colonies:all:geojson', data, 60 * 60)
        return Response(data)


class KhasraGeoJSONView(APIView):
    """GET /api/gis/khasras/geojson/?colony=1"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        colony_id = request.query_params.get('colony')
        from colonies.models import Khasra
        from colonies.serializers import KhasraGeoJSONSerializer
        qs = Khasra.objects.select_related('colony').all()
        if colony_id:
            qs = qs.filter(colony_id=colony_id)
        features = [KhasraGeoJSONSerializer.feature(k) for k in qs]
        return Response({'type': 'FeatureCollection', 'features': features})


class PlotGeoJSONView(APIView):
    """GET /api/gis/plots/geojson/?colony=1&status=patta_ok"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        colony_id = request.query_params.get('colony')
        st        = request.query_params.get('status')
        cache_key = f'gis:plots:colony:{colony_id or "all"}:status:{st or "all"}'
        cached    = cache.get(cache_key)
        if cached:
            return Response(cached)
        try:
            from plots.models import Plot
            from plots.serializers import PlotGeoJSONSerializer
            qs = Plot.objects.select_related('colony').all()
            if colony_id:
                qs = qs.filter(colony_id=colony_id)
            if st:
                qs = qs.filter(status=st)
            data = PlotGeoJSONSerializer.collection(qs)
            cache.set(cache_key, data, 60 * 30)
            return Response(data)
        except Exception:
            return Response({'type': 'FeatureCollection', 'features': []})
