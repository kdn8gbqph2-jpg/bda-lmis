"""
DMS file fetch — proxy the actual scanned PDF from the DMS API.

The DMS .NET API at host.docker.internal:5101 (forwarded via the
dms-tunnel.service from worksserver to dmsserver:5001) returns the PDF
as a base64 string inside a JSON envelope. We decode it once on the
backend and stream it back to the browser as application/pdf so the
client can `<iframe>` or open it without dealing with base64.

Auth: the existing JWT (IsAuthenticated). The endpoint URL embeds the
DMS number, which is opaque to outsiders and only meaningful inside
LMIS, but standard auth is still required to keep this off the public
network.
"""

from __future__ import annotations

import base64
import logging
import os

import requests
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import DmsFile

logger = logging.getLogger(__name__)

# Default to the tunnel endpoint (host.docker.internal:5101). Override
# via DMS_API_URL in .env if the tunnel ever lands somewhere else.
DEFAULT_DMS_API_BASE = 'http://host.docker.internal:5101/api/FileSearch'


def _api_base() -> str:
    return os.environ.get('DMS_API_URL', DEFAULT_DMS_API_BASE).rstrip('/')


class DmsFilePdfView(APIView):
    """
    GET /api/dms/file/<dms_number>.pdf?type=ns|cs

    Returns the scanned PDF for that DMS file, inline so a browser can
    render it directly. 404 if the file isn't in our local mirror; 502
    if the DMS API can't be reached or returns junk.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, dms_number: str):
        pdf_type = (request.query_params.get('type') or 'ns').lower()
        if pdf_type not in ('ns', 'cs'):
            return Response({'detail': 'type must be "ns" or "cs".'}, status=400)

        try:
            mirror = DmsFile.objects.get(dms_number=dms_number)
        except DmsFile.DoesNotExist:
            return Response(
                {'detail': f'DMS number {dms_number!r} not in mirror. '
                           f'Run sync_dms or wait for the nightly job.'},
                status=404,
            )

        if not mirror.department_name:
            return Response(
                {'detail': f'No department recorded for {dms_number} — '
                           f'cannot route the DMS API call.'},
                status=409,
            )
        if (pdf_type == 'ns' and not mirror.has_ns) or \
           (pdf_type == 'cs' and not mirror.has_cs):
            return Response(
                {'detail': f'{pdf_type.upper()} PDF not available for {dms_number} '
                           f'according to the DMS index.'},
                status=404,
            )

        try:
            blob = self._fetch_pdf(mirror.department_name, dms_number, pdf_type)
        except Exception as exc:
            logger.error('DMS fetch failed for %s/%s/%s: %s',
                         mirror.department_name, dms_number, pdf_type, exc, exc_info=True)
            return Response(
                {'detail': f'Could not retrieve PDF from DMS: {type(exc).__name__}: {exc}'},
                status=502,
            )

        resp = HttpResponse(blob, content_type='application/pdf')
        # Show inline in the browser tab. The filename is just a hint
        # for the download dialog if the user hits Ctrl+S.
        resp['Content-Disposition'] = f'inline; filename="{dms_number}-{pdf_type}.pdf"'
        # Don't let the browser cache the binary forever — the underlying
        # scan can be re-uploaded. 1h is plenty for a single user session.
        resp['Cache-Control'] = 'private, max-age=3600'
        return resp

    @staticmethod
    def _fetch_pdf(department: str, file_number: str, pdf_type: str) -> bytes:
        params = {
            'departmentName': department,
            'fileNumber':     file_number,
            'pdfType':        pdf_type,
        }
        url = f'{_api_base()}/get-pdf'
        r = requests.get(url, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        # The DMS API wraps the bytes in either `base64String` (current
        # production) or `fileContents`/`pdfBase64` in older builds — try
        # all three before giving up.
        for key in ('base64String', 'fileContents', 'pdfBase64'):
            if key in data and data[key]:
                return base64.b64decode(data[key])
        raise ValueError(f'DMS response did not contain a known base64 field. Keys: {list(data)}')
