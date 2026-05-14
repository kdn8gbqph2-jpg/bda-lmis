"""
StaffApprovalMixin — viewset mixin that routes Staff JSON writes through
the ChangeRequest queue instead of letting them mutate the real models.

Conventions / scope choices baked in:

  · Only `role='staff'` users get intercepted. Admin and Superintendent
    writes pass through with no change (they are the resolvers).

  · Only JSON content (application/json) is gated. multipart writes
    pass through directly — those are predominantly file uploads
    (colony map, KML, plot template) where re-uploading after approval
    would be more friction than the gate is worth. The user signed off
    on this trade-off explicitly.

  · The mixin only handles create / update / partial_update. delete is
    allowed through unconditionally (rarely used; admin can clean up
    accidents from the audit log).

  · Each viewset declares two class attributes:
        approval_target_type = 'patta' | 'colony' | 'plot'
        approval_target_label_field = 'name' | 'patta_number' | 'plot_number'
    The label is captured at submission time so the bell drop-down has
    something readable to show without joining back to the real model.
"""

from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.response import Response

logger = logging.getLogger(__name__)

STAFF_ROLE = 'staff'

# Fields that should never go through the approval queue. A staff
# save whose only diffs against the current record are in this set
# applies directly — they're either free-form annotations or system-
# linkage fields that don't need a resolver's sign-off:
#
#   remarks / rejection_reason   — narrative notes the spec lets staff
#                                  amend freely.
#   regulation_file_present      — a tri-state filing flag the staff
#                                  toggles as paperwork moves around.
#   dms_file_number              — DMS linkage; gets re-synced
#                                  automatically and is admin-housekeeping.
BYPASS_FIELDS = {
    'remarks', 'rejection_reason',
    'regulation_file_present', 'dms_file_number',
}


class StaffApprovalMixin:
    """
    Drop into any ModelViewSet that has create / update endpoints
    you want gated for Staff users.
    """

    approval_target_type        = None     # required; e.g. 'patta'
    approval_target_label_field = None     # optional; e.g. 'patta_number'

    # ── DRF hooks ────────────────────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        if self._should_queue(request):
            return self._enqueue(request, operation='create')
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if self._should_queue(request):
            return self._enqueue(request, operation='update', target_id=kwargs.get('pk'))
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if self._should_queue(request):
            return self._enqueue(request, operation='update', target_id=kwargs.get('pk'))
        return super().partial_update(request, *args, **kwargs)

    # ── Internals ────────────────────────────────────────────────────────────

    def _should_queue(self, request) -> bool:
        if not self.approval_target_type:
            return False
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'role', None) != STAFF_ROLE:
            return False
        ct = (request.content_type or '').lower()
        if 'multipart' in ct:
            # File uploads bypass the queue — see module docstring.
            return False
        # Saves that only touch bypass-listed fields apply directly.
        if self._is_bypass_only_change(request):
            return False
        return True

    def _is_bypass_only_change(self, request) -> bool:
        """
        Update-only heuristic. Pulls the current record, walks the
        submitted payload, and returns True iff every field that
        differs from the live state is in BYPASS_FIELDS. Falls back
        to False on any error so we err on the side of going through
        approval.
        """
        pk = (self.kwargs or {}).get('pk') if hasattr(self, 'kwargs') else None
        if not pk:
            return False    # create operation; nothing to diff against
        try:
            instance = self.get_queryset().get(pk=pk)
        except Exception:
            return False

        try:
            ReadSer = self.get_serializer_class()
            current = ReadSer(instance, context={'request': request}).data
        except Exception:
            return False

        payload = self._payload_to_json(request.data)
        saw_bypass_change = False
        for k, v in payload.items():
            cur = current.get(k)
            # Cheap string compare handles primitives + dates + numbers
            # — good enough for "did anything outside the bypass set
            # actually change".
            if str(cur if cur is not None else '') == str(v if v is not None else ''):
                continue
            if k in BYPASS_FIELDS:
                saw_bypass_change = True
            else:
                return False     # something tracked differs → queue
        return saw_bypass_change

    def _enqueue(self, request, *, operation, target_id=None):
        from approvals.models import ChangeRequest

        # Coerce request.data into a plain JSON-able dict so it survives
        # JSONField storage. Lists of primitives (e.g. plots[]) come in
        # as QueryDict-likes; dict() flattens for JSON.
        try:
            payload = self._payload_to_json(request.data)
        except Exception as exc:
            logger.warning('approvals._enqueue payload coercion failed: %s', exc, exc_info=True)
            payload = {}

        # Pick a label that makes sense in the bell dropdown.
        label_field = self.approval_target_label_field
        label = ''
        if label_field:
            label = str(payload.get(label_field, '') or '').strip()
        if not label and target_id is not None and label_field:
            try:
                qs    = self.get_queryset()
                obj   = qs.get(pk=target_id)
                label = str(getattr(obj, label_field, '') or '').strip()
            except Exception:
                label = ''

        cr = ChangeRequest.objects.create(
            target_type   = self.approval_target_type,
            target_id     = target_id if target_id is None else int(target_id),
            operation     = operation,
            payload       = payload,
            requested_by  = request.user,
            target_label  = label[:255],
        )

        logger.info(
            'ChangeRequest %s created — %s.%s by %s (target=%s, op=%s)',
            cr.pk, self.approval_target_type, target_id or '∅',
            request.user.username, label or '∅', operation,
        )

        return Response(
            {
                'detail':            'Submitted for approval. An Admin or '
                                     'Superintendent will review your changes shortly.',
                'change_request_id': cr.pk,
                'status':            'pending',
                'target_label':      label,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @staticmethod
    def _payload_to_json(data):
        """
        Translate DRF's QueryDict / parser output into a JSON-clean dict.
        Multi-value keys (e.g. `plots`) become lists of dicts; single
        values stay primitives.
        """
        if hasattr(data, 'lists'):
            out = {}
            for k, v in data.lists():
                out[k] = v if len(v) > 1 else v[0]
            return out
        if isinstance(data, dict):
            return dict(data)
        return {'value': data}
