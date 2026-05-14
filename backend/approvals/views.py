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
        params = self.request.query_params
        # Filter by status query param so the bell can ask for ?status=pending.
        st = params.get('status')
        if st:
            qs = qs.filter(status=st)
        # Edit modals + detail pages pass ?target_type=plot&target_id=42 to
        # scope the query to one record. Without these, every per-record
        # query returned the entire pending list and any record's banner
        # would fire on any pending CR (bug surfaced when an unrelated
        # plot edit caused a patta detail page to show 'Edit pending').
        tt = params.get('target_type')
        if tt:
            qs = qs.filter(target_type=tt)
        tid = params.get('target_id')
        if tid:
            try:
                qs = qs.filter(target_id=int(tid))
            except (TypeError, ValueError):
                qs = qs.none()
        # Staff users only see their own requests; resolvers see everything.
        if not _is_resolver(self.request.user):
            qs = qs.filter(requested_by=self.request.user)
        return qs

    # ── /count/ ── lightweight endpoint for the bell badge ──────────────────

    @action(detail=False, methods=['get'])
    def count(self, request):
        if not _is_resolver(request.user):
            # Staff: count both 'awaiting decision' and 'recently
            # rejected — needs your attention' so the bell badge nags
            # them until they dismiss the rejection.
            n = ChangeRequest.objects.filter(
                requested_by=request.user,
                status__in=('pending', 'rejected'),
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
        #
        # Tell the audit signal which ChangeRequest this save is part of
        # — the audit_post_save handler reads this thread-local and
        # stamps both `submitted_by` (cr.requested_by) and the FK back to
        # the CR on the AuditLog row, so the Edit History UI can show
        # "Submitted by X · Approved by Y" without a second join.
        from audit.middleware import set_current_change_request
        set_current_change_request(cr)
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
        finally:
            # Clear the context so the next save on this thread (e.g. the
            # bulk delete below) doesn't accidentally inherit the CR FK.
            set_current_change_request(None)

        # Capture identifying info before deleting the CR — we want it
        # for the log line and the response body.
        cr_pk         = cr.pk
        target_type   = cr.target_type
        target_id     = cr.target_id or instance.pk
        resolver_name = request.user.get_full_name() or request.user.username

        # Hard-delete the resolved CR and any sibling pending CRs for
        # the same record. Intent: ChangeRequest table holds only
        # pending work, never historical decisions. AuditLog row written
        # above had `change_request=cr`; on_delete=SET_NULL nulls that
        # FK but preserves `submitted_by`, which is what the UI uses to
        # mark approval-sourced rows.
        ChangeRequest.objects.filter(
            target_type=target_type,
            target_id=target_id,
            status='pending',
        ).exclude(pk=cr_pk).delete()
        cr.delete()

        logger.info(
            'ChangeRequest #%s approved by %s — %s #%s applied; CR removed',
            cr_pk, resolver_name, target_type, target_id,
        )
        return Response({
            'detail':      'Approved and applied.',
            'target_type': target_type,
            'target_id':   target_id,
        })

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

        # Keep the rejected CR row so the submitter can see in the bell
        # that their proposal was turned down (plus the optional notes).
        # The DB cost is bounded by the weekly sweep task that purges
        # rejected rows older than the retention window.
        cr.status           = 'rejected'
        cr.resolved_by      = request.user
        cr.resolved_at      = timezone.now()
        cr.resolution_notes = (request.data.get('notes') or '').strip()
        cr.save(update_fields=['status', 'resolved_by', 'resolved_at', 'resolution_notes'])

        # Drop sibling pending CRs on the same record — once one variant
        # is decided, the others are stale and shouldn't sit in the queue.
        ChangeRequest.objects.filter(
            target_type=cr.target_type,
            target_id=cr.target_id,
            status='pending',
        ).exclude(pk=cr.pk).delete()

        logger.info('ChangeRequest #%s rejected by %s', cr.pk, request.user.username)
        return Response({
            'detail':      'Rejected.',
            'target_type': cr.target_type,
            'target_id':   cr.target_id,
        })

    # ── /{id}/dismiss/ ──────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """
        Submitter clears their own rejected ChangeRequest from the bell
        after acknowledging it. Admins don't need this — they already
        have approve/reject. Only the original requester can dismiss,
        and only rejected rows (pending ones stay until resolved).
        """
        cr = self.get_object()
        if cr.requested_by_id != request.user.id:
            return Response({'detail': 'Not your request.'},
                            status=status.HTTP_403_FORBIDDEN)
        if cr.status != 'rejected':
            return Response({'detail': 'Only rejected requests can be dismissed.'},
                            status=status.HTTP_400_BAD_REQUEST)
        cr_pk = cr.pk
        cr.delete()
        logger.info('ChangeRequest #%s dismissed by submitter %s',
                    cr_pk, request.user.username)
        return Response({'detail': 'Dismissed.'})
