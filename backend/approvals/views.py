"""
ChangeRequest API.

Endpoints (all under /api/approvals/):

    GET    /                       list (admin + super see everything;
                                    staff see only their own submissions)
    GET    /?status=pending        common filter for the bell drop-down
    GET    /count/                 unread/pending count for the bell badge
    GET    /{id}/                  detail (full payload)
    POST   /{id}/approve/          run the queued payload against the
                                    real model and stamp the audit trail
    POST   /{id}/reject/           dismiss without applying

Resolution registry (TARGET_REGISTRY) maps target_type to its model +
write serializer. Add new gated entities by extending it.
"""

from __future__ import annotations

import logging

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.permissions import IsAdmin
from .models import ChangeRequest
from .serializers import ChangeRequestListSerializer, ChangeRequestDetailSerializer

logger = logging.getLogger(__name__)


# ── Resolver registry ────────────────────────────────────────────────────────
# Imports happen inside _resolver() so app load order stays loose
# (approvals doesn't have to import pattas/colonies/plots at module load).

def _resolver(target_type):
    if target_type == 'patta':
        from pattas.models      import Patta
        from pattas.serializers import PattaWriteSerializer
        return Patta, PattaWriteSerializer
    if target_type == 'colony':
        from colonies.models      import Colony
        from colonies.serializers import ColonyDetailSerializer
        return Colony, ColonyDetailSerializer
    if target_type == 'plot':
        from plots.models      import Plot
        from plots.serializers import PlotWriteSerializer
        return Plot, PlotWriteSerializer
    raise ValueError(f'Unsupported target_type: {target_type!r}')


def _is_resolver(user):
    """Admin or Superintendent can approve/reject."""
    return getattr(user, 'role', None) in ('admin', 'superintendent')


# ── ViewSet ──────────────────────────────────────────────────────────────────

class ChangeRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only on the CRUD verbs; mutations happen via the
    `approve` / `reject` actions below.
    """

    permission_classes = [IsAuthenticated]
    queryset = ChangeRequest.objects.select_related('requested_by', 'resolved_by')

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ChangeRequestDetailSerializer
        return ChangeRequestListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by status query param so the bell can ask for ?status=pending.
        st = self.request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        # Staff users only see their own requests; resolvers see everything.
        if not _is_resolver(self.request.user):
            qs = qs.filter(requested_by=self.request.user)
        return qs

    # ── /count/ ── lightweight endpoint for the bell badge ──────────────────

    @action(detail=False, methods=['get'])
    def count(self, request):
        if not _is_resolver(request.user):
            # Staff can see their own pending count too — it's a useful
            # "your submissions awaiting review" indicator.
            n = ChangeRequest.objects.filter(
                status='pending', requested_by=request.user,
            ).count()
            return Response({'pending': n, 'role': 'staff'})

        n = ChangeRequest.objects.filter(status='pending').count()
        return Response({'pending': n, 'role': 'resolver'})

    # ── /{id}/approve/ ──────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not _is_resolver(request.user):
            return Response({'detail': 'Only Admin or Superintendent can approve.'},
                            status=status.HTTP_403_FORBIDDEN)

        cr = self.get_object()
        if cr.status != 'pending':
            return Response({'detail': f'Request is already {cr.status}.'},
                            status=status.HTTP_409_CONFLICT)

        try:
            Model, WriteSerializer = _resolver(cr.target_type)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Stamp the audit trail into the `remarks` field. Two lines —
        # who submitted and who approved — appended to whatever the
        # staff member already typed. Survives across re-edits via the
        # normal audit log.
        payload = dict(cr.payload or {})
        submitted = (
            f'Submitted by {cr.requested_by_name} '
            f'on {cr.requested_at:%Y-%m-%d %H:%M}'
        )
        approved = (
            f'Approved by {request.user.get_full_name() or request.user.username} '
            f'on {timezone.now():%Y-%m-%d %H:%M}'
        )
        existing = (payload.get('remarks') or '').strip()
        payload['remarks'] = '\n'.join(filter(None, [existing, submitted, approved]))

        # Run the original write serializer so all validation /
        # cascade-effects (PlotPattaMapping, khasras_input, etc.)
        # behave identically to a direct admin save.
        try:
            if cr.operation == 'create':
                ser = WriteSerializer(data=payload, context={'request': request})
                ser.is_valid(raise_exception=True)
                instance = ser.save()
            else:
                if cr.target_id is None:
                    return Response({'detail': 'update request has no target_id'},
                                    status=status.HTTP_400_BAD_REQUEST)
                instance = Model.objects.get(pk=cr.target_id)
                ser = WriteSerializer(instance, data=payload,
                                      partial=True, context={'request': request})
                ser.is_valid(raise_exception=True)
                instance = ser.save()
        except Model.DoesNotExist:
            return Response(
                {'detail': f'Target {cr.target_type} #{cr.target_id} no longer exists.'},
                status=status.HTTP_410_GONE,
            )
        except Exception as exc:
            logger.error('approve failed for cr=%s: %s', cr.pk, exc, exc_info=True)
            return Response(
                {'detail': f'Could not apply change: {type(exc).__name__}: {exc}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cr.status           = 'approved'
        cr.resolved_by      = request.user
        cr.resolved_at      = timezone.now()
        cr.resolution_notes = (request.data.get('notes') or '').strip()
        if cr.target_id is None:
            cr.target_id = instance.pk
        cr.save(update_fields=['status', 'resolved_by', 'resolved_at',
                                'resolution_notes', 'target_id'])

        logger.info('ChangeRequest %s approved by %s', cr.pk, request.user.username)
        return Response(ChangeRequestDetailSerializer(cr).data)

    # ── /{id}/reject/ ───────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not _is_resolver(request.user):
            return Response({'detail': 'Only Admin or Superintendent can reject.'},
                            status=status.HTTP_403_FORBIDDEN)

        cr = self.get_object()
        if cr.status != 'pending':
            return Response({'detail': f'Request is already {cr.status}.'},
                            status=status.HTTP_409_CONFLICT)

        cr.status           = 'rejected'
        cr.resolved_by      = request.user
        cr.resolved_at      = timezone.now()
        cr.resolution_notes = (request.data.get('notes') or '').strip()
        cr.save(update_fields=['status', 'resolved_by', 'resolved_at', 'resolution_notes'])

        logger.info('ChangeRequest %s rejected by %s', cr.pk, request.user.username)
        return Response(ChangeRequestDetailSerializer(cr).data)
