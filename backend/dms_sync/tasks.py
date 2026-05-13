"""
Celery task wrapper for the sync_dms management command.

Kept thin on purpose: the heavy logic lives in the management command so
it can be smoke-tested via `manage.py sync_dms` without needing a worker.
"""

import logging

from celery import shared_task
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(
    name='dms_sync.sync',
    bind=True,
    max_retries=2,
    default_retry_delay=15 * 60,   # 15 minutes between retries
    autoretry_for=(Exception,),
)
def sync_dms(self):
    """Nightly pull from dmsserver → local DmsFile mirror."""
    logger.info('dms_sync.sync starting (task=%s)', self.request.id)
    call_command('sync_dms')
    logger.info('dms_sync.sync finished (task=%s)', self.request.id)
