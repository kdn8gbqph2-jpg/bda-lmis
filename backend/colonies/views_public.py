"""
Public (unauthenticated) API views for the colony dashboard.

All endpoints are read-only and require no authentication so that the
public-facing website can display colony information without a login.

Endpoints (mounted under /api/public/):
    GET  /api/public/colonies/          — paginated list, filterable by colony_type / zone
    GET  /api/public/colonies/{id}/     — full detail + khasras
    GET  /api/public/colonies/{id}/map/<fmt>/  — download PDF / SVG / PNG map
    GET  /api/public/colonies/geojson/  — GeoJSON FeatureCollection
    GET  /api/public/colony-types/      — label/value list of colony_type choices
"""

import logging

from rest_framework import generics, filters
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse, Http404
from django_filters.rest_framework import DjangoFilterBackend

from .models import Colony, COLONY_TYPE_CHOICES
from .serializers import (
    PublicColonyListSerializer,
    PublicColonyDetailSerializer,
    ColonyGeoJSONSerializer,
)
from .filters import ColonyFilter

logger = logging.getLogger(__name__)


class PublicColonyListView(generics.ListAPIView):
    """
    GET /api/public/colonies/

    Returns a paginated list of colonies.  Supports:
      - ?colony_type=bda_scheme|private_approved|suo_moto|pending_layout|rejected_layout
      - ?zone=North|South|...
      - ?search=<name substring>
    """
    serializer_class   = PublicColonyListSerializer
    permission_classes = [AllowAny]
    filterset_class    = ColonyFilter
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['name']
    ordering_fields    = ['name', 'layout_approval_date', 'layout_application_date']
    ordering           = ['name']

    def get_queryset(self):
        return Colony.objects.filter(status='active').only(
            'id', 'name', 'colony_type', 'zone',
            'layout_application_date', 'layout_approval_date',
            'total_residential_plots', 'total_commercial_plots',
            'map_pdf', 'map_svg', 'map_png',
        )


class PublicColonyDetailView(generics.RetrieveAPIView):
    """
    GET /api/public/colonies/{id}/
    """
    serializer_class   = PublicColonyDetailSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Colony.objects.filter(status='active').prefetch_related('khasras')


class PublicColonyMapDownloadView(APIView):
    """
    GET /api/public/colonies/{pk}/map/<fmt>/

    Streams an uploaded map file (pdf / svg / png) as an attachment.
    Returns 404 when the requested format has not been uploaded.
    """
    permission_classes = [AllowAny]

    _CONTENT_TYPES = {
        'pdf': 'application/pdf',
        'svg': 'image/svg+xml',
        'png': 'image/png',
    }

    def get(self, request, pk, fmt):
        if fmt not in self._CONTENT_TYPES:
            raise Http404('Invalid map format.')

        try:
            colony = Colony.objects.filter(status='active').get(pk=pk)
        except Colony.DoesNotExist:
            raise Http404('Colony not found.')

        file_field = getattr(colony, f'map_{fmt}')
        if not file_field:
            logger.debug('Public map download: colony %s has no map_%s.', pk, fmt)
            raise Http404(f'No {fmt.upper()} map available for this colony.')

        logger.info('Public map download: map_%s for colony %s.', fmt, pk)
        response = FileResponse(file_field.open('rb'), content_type=self._CONTENT_TYPES[fmt])
        response['Content-Disposition'] = (
            f'attachment; filename="{colony.name}_{fmt}.{fmt}"'
        )
        return response


class PublicColonyGeoJSONView(APIView):
    """
    GET /api/public/colonies/geojson/?colony_type=...&zone=...

    Returns a GeoJSON FeatureCollection of active colonies.
    Filtered by colony_type and/or zone query params.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        qs = Colony.objects.filter(status='active')

        colony_type = request.query_params.get('colony_type')
        zone        = request.query_params.get('zone')
        if colony_type:
            qs = qs.filter(colony_type__iexact=colony_type)
        if zone:
            qs = qs.filter(zone__iexact=zone)

        return Response(ColonyGeoJSONSerializer.collection(qs))


class ColonyTypeListView(APIView):
    """
    GET /api/public/colony-types/

    Returns the list of colony type choices as [{value, label}, ...].
    Used by the public dashboard filter dropdowns.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        data = [{'value': v, 'label': l} for v, l in COLONY_TYPE_CHOICES]
        return Response(data)
