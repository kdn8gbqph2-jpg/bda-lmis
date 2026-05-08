import mimetypes
import os

from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .filters import DocumentFilter
from .models import Document
from .serializers import (
    DocumentListSerializer,
    DocumentDetailSerializer,
    DocumentUploadSerializer,
)
from users.permissions import IsAdmin, IsStaffOrAbove, IsAdminOrSuperintendent


class DocumentViewSet(viewsets.ModelViewSet):
    """
    GET    /api/documents/              list   (authenticated)
    POST   /api/documents/              upload (staff+, multipart)
    GET    /api/documents/{id}/         detail
    DELETE /api/documents/{id}/         admin only — SOFT DELETE (no hard delete, 7-yr rule)
    GET    /api/documents/{id}/preview/ serve file for browser viewing
    POST   /api/documents/{id}/verify/  superintendent+ — mark as verified
    """

    queryset        = Document.objects.select_related(
        'uploaded_by', 'verified_by', 'linked_plot', 'linked_patta'
    ).all()
    filterset_class = DocumentFilter
    ordering_fields = ['uploaded_at', 'document_type', 'status']
    ordering        = ['-uploaded_at']

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdmin()]
        if self.action == 'verify':
            return [IsAuthenticated(), IsAdminOrSuperintendent()]
        if self.action == 'create':
            return [IsAuthenticated(), IsStaffOrAbove()]
        return [IsAuthenticated()]

    def get_parsers(self):
        if self.action == 'create':
            return [MultiPartParser(), FormParser()]
        return super().get_parsers()

    def get_serializer_class(self):
        if self.action == 'list':
            return DocumentListSerializer
        if self.action == 'create':
            return DocumentUploadSerializer
        return DocumentDetailSerializer

    # ── Prevent hard delete (7-year government retention) ────────────────────

    def destroy(self, request, *args, **kwargs):
        """
        Government compliance: hard-deletes are never allowed.
        Admin can only mark a document's status so it's hidden from
        normal searches.  The record is never removed from the DB.
        """
        return Response(
            {
                'detail': (
                    'Hard-delete of documents is not permitted (7-year retention policy). '
                    'Contact a database administrator to archive this record.'
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    # ── Create: inject uploaded_by from request.user ──────────────────────────

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    # ── /api/documents/{id}/preview/ ──────────────────────────────────────────

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        """
        Serve the file for browser rendering.
        For S3 storage, returns a redirect to the presigned URL.
        For local storage, streams the file.
        """
        doc = self.get_object()
        if not doc.file:
            raise Http404('No file attached to this document.')

        try:
            file_url = doc.file.url
        except Exception:
            raise Http404('File not accessible.')

        # If the URL is an external URL (S3 presigned), redirect
        if file_url.startswith('http'):
            from django.shortcuts import redirect
            return redirect(file_url)

        # Local file: stream it
        try:
            file_path = doc.file.path
            if not os.path.exists(file_path):
                raise Http404('File not found on disk.')
            content_type = doc.mime_type or (
                mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
            )
            response = FileResponse(
                open(file_path, 'rb'),
                content_type=content_type,
            )
            response['Content-Disposition'] = (
                f'inline; filename="{doc.original_filename}"'
            )
            return response
        except Exception as exc:
            raise Http404(f'Could not serve file: {exc}')

    # ── /api/documents/{id}/verify/ ───────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        doc = self.get_object()
        if doc.status == 'verified':
            return Response(
                {'detail': 'Document is already verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        doc.status      = 'verified'
        doc.verified_by = request.user
        doc.verified_at = timezone.now()
        doc.save(update_fields=['status', 'verified_by', 'verified_at', 'updated_at'])
        return Response(DocumentDetailSerializer(doc).data)
