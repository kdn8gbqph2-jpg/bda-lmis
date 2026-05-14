"""
ChangeRequest — pending modification to a Patta / Colony / Plot record
submitted by a Staff user, awaiting approval from an Admin or
Superintendent.

The submitted payload is held in a JSONB blob. Files are NOT moderated
through this queue (those go through directly when the staff member
submits multipart) — only the text/data half of a save is gated. See
approvals.mixins.StaffApprovalMixin for the intercept logic.

Lifecycle:

    Staff submits JSON write
        → ChangeRequest(status='pending') created, no real-model write
        → bell on Admin/Super topbar shows the count
    Admin/Super clicks Approve
        → registered serializer runs against the real model
        → remarks field gets a stamped trail ("Submitted by …, Approved by …")
        → ChangeRequest(status='approved', resolved_by=…) recorded
    Admin/Super clicks Reject
        → ChangeRequest(status='rejected', resolved_by=…, resolution_notes=…)
        → nothing else changes; staff sees the rejection in their queue
"""

from django.conf import settings
from django.db import models


TARGET_CHOICES = [
    ('patta',  'Patta'),
    ('colony', 'Colony'),
    ('plot',   'Plot'),
]

OPERATION_CHOICES = [
    ('create', 'Create'),
    ('update', 'Update'),
]

STATUS_CHOICES = [
    ('pending',  'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class ChangeRequest(models.Model):
    target_type = models.CharField(
        max_length=20, choices=TARGET_CHOICES, db_index=True,
        help_text="Model the change applies to.",
    )
    target_id = models.IntegerField(
        null=True, blank=True,
        help_text="PK of the row being updated; null for create operations.",
    )
    operation = models.CharField(max_length=10, choices=OPERATION_CHOICES)
    payload   = models.JSONField(
        help_text="The exact serializer payload the staff member submitted.",
    )

    status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True,
    )

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='change_requests_submitted',
    )
    requested_at  = models.DateTimeField(auto_now_add=True)
    request_notes = models.TextField(
        blank=True, help_text="Optional note the staff member attached.",
    )

    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='change_requests_resolved',
    )
    resolved_at      = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(
        blank=True, help_text="Admin/Super's reason on approve/reject.",
    )

    # Convenience snapshot of the target's display name at submission
    # time, so the bell dropdown doesn't have to join through to the
    # real record (which may not exist yet on a create request).
    target_label = models.CharField(
        max_length=255, blank=True,
        help_text="Best-effort display name (colony name / patta number / plot number).",
    )

    class Meta:
        db_table = 'approvals_changerequest'
        ordering = ['-requested_at']
        indexes  = [
            models.Index(fields=['status', 'requested_at']),
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        return (
            f'{self.get_operation_display()} {self.get_target_type_display()}'
            f' #{self.pk} — {self.status}'
        )

    # ── Helpers ─────────────────────────────────────────────────────────────
    @property
    def requested_by_name(self):
        u = self.requested_by
        return (u.get_full_name() or u.username) if u else ''

    @property
    def resolved_by_name(self):
        u = self.resolved_by
        return (u.get_full_name() or u.username) if u else ''
