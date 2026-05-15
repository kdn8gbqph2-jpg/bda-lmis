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
      - ?zone=East|West
      - ?search=<name substring>
    """
    serializer_class   = PublicColonyListSerializer
    permission_classes = [AllowAny]
    filterset_class    = ColonyFilter
    filter_backends    = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['name']
    ordering_fields    = ['name', 'layout_approval_date']
    ordering           = ['name']

    def get_queryset(self):
        # prefetch_related('khasras') so the list-row khasra summary
        # doesn't N+1 — one extra query for all khasras across the
        # page instead of one per row.
        return (
            Colony.objects.filter(status='active')
            .only(
                'id', 'name', 'colony_type', 'zone',
                'revenue_village',
                'layout_approval_date',
                'total_residential_plots', 'total_commercial_plots',
                'map_pdf', 'map_jpeg', 'map_png', 'map_svg',
            )
            .prefetch_related('khasras')
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
        'pdf':  'application/pdf',
        'jpeg': 'image/jpeg',
        'png':  'image/png',
        'svg':  'image/svg+xml',
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

        # ?disposition=inline lets the frontend render the file in an
        # <iframe> / <img> for preview; default stays attachment so
        # plain link clicks still trigger a save dialog as before.
        disp = 'inline' if request.GET.get('disposition') == 'inline' else 'attachment'

        logger.info('Public map %s (%s) for colony %s.', fmt, disp, pk)
        response = FileResponse(file_field.open('rb'), content_type=self._CONTENT_TYPES[fmt])
        # ASCII-only filename. Putting Hindi (or any non-ASCII) text in
        # the `filename` parameter makes wsgiref MIME-encode the whole
        # Content-Disposition value (=?utf-8?b?...?=), which buries the
        # `inline` directive inside a base64 blob and breaks browser
        # preview. Stick to pk-based names; the human-readable colony
        # name is on the page itself.
        ascii_name = f'colony-{colony.pk}-{fmt}.{fmt}'
        response['Content-Disposition'] = f'{disp}; filename="{ascii_name}"'
        if disp == 'inline':
            # Django's SecurityMiddleware sets X-Frame-Options: DENY by
            # default, which would block our same-origin LayoutPreview
            # iframe. Override to SAMEORIGIN only for the preview path.
            response['X-Frame-Options'] = 'SAMEORIGIN'
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

        # colony_type may be a comma-separated list to match the multi-
        # select filter on the public colonies page. Single-value calls
        # still work because a one-element __in is equivalent to iexact.
        colony_type = request.query_params.get('colony_type')
        zone        = request.query_params.get('zone')
        if colony_type:
            wanted = [t.strip() for t in colony_type.split(',') if t.strip()]
            if wanted:
                qs = qs.filter(colony_type__in=wanted)
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
