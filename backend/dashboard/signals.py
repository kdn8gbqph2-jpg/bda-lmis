"""
Dashboard cache invalidation.

The dashboard endpoints cache their aggregate responses for 5–10 minutes
to keep page loads fast under fan-out from many concurrent users. When
the underlying data changes (colony/patta/plot/document mutations), the
caches go stale and the dashboard stops reflecting reality until the
TTL expires.

This module wires post_save / post_delete handlers on the four tracked
models to delete the dashboard cache keys, so the next request rebuilds
them with fresh data. We also drop per-colony stat keys belonging to
the affected colony where we can determine it.
"""

import logging
from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)

# Keys shared across the dashboard endpoints (must stay in sync with views.py)
_DASHBOARD_KEYS = (
    'dashboard:stats',
    'dashboard:colony-progress',
    'dashboard:zone-breakdown',
    'dashboard:charts',
    'colonies:all',
    'colonies:all:geojson',
)


def _flush_dashboard(colony_id=None):
    """Delete the shared dashboard keys + the per-colony stats key when known."""
    keys = list(_DASHBOARD_KEYS)
    if colony_id is not None:
        keys.append(f'colony:{colony_id}:stats')
        keys.append(f'geojson:plots:{colony_id}')
    cache.delete_many(keys)


def _colony_id_of(instance) -> int | None:
    """Best-effort lookup of the colony FK on any of the four tracked models."""
    for attr in ('colony_id', 'colony_pk'):
        if getattr(instance, attr, None) is not None:
            return getattr(instance, attr)
    # Plot/Document/Patta all expose .colony_id directly via the FK column
    return None


def _make_handler(label: str):
    def _handler(sender, instance, **kwargs):
        try:
            _flush_dashboard(_colony_id_of(instance))
        except Exception:
            logger.warning('dashboard cache flush failed for %s', label, exc_info=True)
    _handler.__name__ = f'dashboard_flush_on_{label}'
    return _handler


def connect_signals():
    """Wire post_save / post_delete on the four tracked models."""
    from colonies.models  import Colony
    from plots.models     import Plot
    from pattas.models    import Patta
    from documents.models import Document

    for model, label in (
        (Colony,   'colony'),
        (Plot,     'plot'),
        (Patta,    'patta'),
        (Document, 'document'),
    ):
        handler = _make_handler(label)
        post_save.connect(handler,   sender=model, weak=False,
                          dispatch_uid=f'dashboard.cache.save.{label}')
        post_delete.connect(handler, sender=model, weak=False,
                            dispatch_uid=f'dashboard.cache.delete.{label}')
