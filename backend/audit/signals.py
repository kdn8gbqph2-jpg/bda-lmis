"""
Audit signal handlers.

Tracked models: Colony, Plot, Patta, Document
(Khasra changes are captured as part of Colony operations)

Strategy:
  pre_save  → fetch old field values from DB before the save
  post_save → write AuditLog(action='create' | 'update', new_values=...)
  post_delete → write AuditLog(action='delete', old_values=...)

Geometry and file fields are excluded from JSON snapshots to keep
audit entries readable and storage-efficient.
"""

from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver

from .middleware import (
    get_current_user, get_current_request_meta, get_current_change_request,
)
from .models import AuditLog


# ── Fields to exclude from JSON snapshots ─────────────────────────────────────

_SKIP_FIELD_TYPES = (
    'PolygonField', 'MultiPolygonField', 'GeometryField',
    'GeometryCollectionField', 'PointField', 'LineStringField',
    'FileField',
)


def _serialize(instance) -> dict:
    """
    Produce a plain dict of an instance's non-spatial, non-file field values.
    FK fields are stored as `field_id` integers.
    """
    data = {}
    for field in instance._meta.concrete_fields:
        field_type = type(field).__name__
        if field_type in _SKIP_FIELD_TYPES:
            continue
        value = field.value_from_object(instance)
        # Make datetimes and dates JSON-safe
        if hasattr(value, 'isoformat'):
            value = value.isoformat()
        data[field.attname] = value
    return data


def _fetch_old(instance) -> dict | None:
    """Load current DB state before a save; returns None for new objects."""
    if instance.pk is None:
        return None
    try:
        old = instance.__class__.objects.filter(pk=instance.pk).first()
        return _serialize(old) if old else None
    except Exception:
        return None


def _write_log(entity_type: str, entity_id, action: str,
               old_values=None, new_values=None):
    """Create one AuditLog row; never raises (audit must not break app flow).

    Uses its own savepoint so that a DB error inside here does NOT corrupt
    the caller's transaction (e.g. management commands, bulk imports).

    When an approval flow is in progress (ChangeRequest context set via
    audit.middleware.set_current_change_request), the resulting AuditLog
    captures both the resolver (current request user) AND the original
    staff submitter, plus a FK back to the ChangeRequest itself.

    After a successful write, prior audit rows for the same record are
    pruned per-field so the AuditLog grows by unique field, not by save
    event — see _prune_prior. Skips pruning for delete/reject actions.
    """
    from django.db import transaction as _tx
    user = get_current_user()
    ip, ua = get_current_request_meta()
    cr = get_current_change_request()

    entry = None
    try:
        with _tx.atomic():          # savepoint — rolls back only THIS write on failure
            entry = AuditLog.objects.create(
                user=user,
                submitted_by=(cr.requested_by if cr else None),
                change_request=cr,
                entity_type=entity_type,
                entity_id=entity_id,
                action=action,
                old_values=old_values,
                new_values=new_values,
                ip_address=ip,
                user_agent=ua or '',
            )
    except Exception:
        return                      # never let audit failures propagate

    # Prune in a separate savepoint so a failure here can't undo the write
    # we just made. Only runs for state-changing actions: a delete row is
    # already terminal (no later updates) and an informational row would
    # incorrectly look like the latest truth for the fields it carries.
    if entry and action in ('create', 'update') and new_values:
        try:
            with _tx.atomic():
                _prune_prior(entry, set(new_values.keys()))
        except Exception:
            pass


def _prune_prior(new_entry, superseded_keys):
    """
    Walk older AuditLog rows for the same (entity_type, entity_id) and
    strip out any field key that's in `superseded_keys` (the keys the
    new entry just wrote). A row that loses every field this way is
    deleted entirely. Result: each (record, field) has at most one
    AuditLog row — the most recent one to touch it.

    Caller's responsibility to wrap in its own savepoint.
    """
    if not superseded_keys:
        return
    prior = AuditLog.objects.filter(
        entity_type=new_entry.entity_type,
        entity_id=new_entry.entity_id,
    ).exclude(pk=new_entry.pk).only('pk', 'old_values', 'new_values', 'action')

    for prev in prior:
        new_v = prev.new_values or {}
        if not (set(new_v.keys()) & superseded_keys):
            continue
        kept_new = {k: v for k, v in new_v.items() if k not in superseded_keys}
        if not kept_new:
            prev.delete()
            continue
        old_v    = prev.old_values or {}
        kept_old = {k: v for k, v in old_v.items() if k not in superseded_keys}
        prev.new_values = kept_new
        prev.old_values = kept_old or None
        prev.save(update_fields=['new_values', 'old_values'])


# ── Thread-local pre-save cache ───────────────────────────────────────────────

import threading
_pre_save_cache = threading.local()


# ── Generic handler factory ───────────────────────────────────────────────────

def _register(model_class, entity_type: str):
    """Wire pre_save + post_save + post_delete for one model."""

    @receiver(pre_save, sender=model_class, weak=False)
    def _pre(sender, instance, **kwargs):
        cache = getattr(_pre_save_cache, 'data', {})
        # Use a key that's unique per instance identity
        cache[id(instance)] = _fetch_old(instance)
        _pre_save_cache.data = cache

    @receiver(post_save, sender=model_class, weak=False)
    def _post(sender, instance, created, **kwargs):
        cache  = getattr(_pre_save_cache, 'data', {})
        old    = cache.pop(id(instance), None)
        action = 'create' if created else 'update'
        new    = _serialize(instance)
        _write_log(entity_type, instance.pk, action,
                   old_values=old if not created else None,
                   new_values=new)

    @receiver(post_delete, sender=model_class, weak=False)
    def _del(sender, instance, **kwargs):
        _write_log(entity_type, instance.pk, 'delete',
                   old_values=_serialize(instance))

    # Give the functions meaningful names for Django's signal registry
    _pre.__name__  = f'audit_pre_save_{entity_type}'
    _post.__name__ = f'audit_post_save_{entity_type}'
    _del.__name__  = f'audit_post_delete_{entity_type}'


def connect_signals():
    """
    Called from AuditConfig.ready() to register all signal handlers.
    Importing models here (not at module top) avoids AppRegistryNotReady.
    """
    from colonies.models  import Colony
    from plots.models     import Plot
    from pattas.models    import Patta
    from documents.models import Document

    _register(Colony,   'colony')
    _register(Plot,     'plot')
    _register(Patta,    'patta')
    _register(Document, 'document')
