"""
Celery tasks for the approvals app.

Currently one task — `sweep_old_rejected` — runs daily via celery-beat
(see config.settings.CELERY_BEAT_SCHEDULE) to hard-delete rejected
ChangeRequests older than the retention window. Rejected rows stick
around long enough for the submitter to see them in the bell and
dismiss; the sweep takes care of anything they never got around to.
"""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import ChangeRequest

logger = logging.getLogger(__name__)

REJECTED_RETENTION_DAYS = 7


@shared_task(name='approvals.sweep_old_rejected')
def sweep_old_rejected():
    """Hard-delete rejected ChangeRequests older than the retention window."""
    cutoff = timezone.now() - timedelta(days=REJECTED_RETENTION_DAYS)
    qs = ChangeRequest.objects.filter(status='rejected', resolved_at__lt=cutoff)
    n = qs.count()
    if n:
        qs.delete()
        logger.info(
            'Swept %d rejected ChangeRequests older than %d days',
            n, REJECTED_RETENTION_DAYS,
        )
    return n
