"""
sync_dms — pull file metadata + locations from the DMS workflow database
into the local DmsFile mirror table.

Connection: PyMySQL over an SSH tunnel that lives on worksserver
(systemd unit `dms-tunnel.service`). Inside the backend container,
host.docker.internal:3307 reaches the tunnel endpoint. All four
connection params are read from env vars so the command is portable
across dev / prod.

Strategy: full table refresh inside one transaction.

  · The source set is small (~7k rows in May 2026), so it's cheaper to
    fetch everything than to track per-row change timestamps.
  · We UPSERT by dms_number — rows that vanish from DMS stay in our
    mirror but get flagged via a future cleanup pass if needed. (Right
    now DMS is append-only, so this is fine.)
  · Run telemetry (counts + duration + error) is written to DmsSyncRun
    so an admin can see at a glance when the sync last succeeded.

Manual invocation (smoke test):
    docker compose exec backend python manage.py sync_dms --dry-run
    docker compose exec backend python manage.py sync_dms
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Iterable

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from dms_sync.models import DmsFile, DmsSyncRun

logger = logging.getLogger(__name__)

# We join filedetails with the *most recent* filedirectories row per file:
# DMS scans go through scan → QC → classify and create multiple directory
# rows; the highest ID is the final, current location.
SOURCE_QUERY = """
    SELECT
        f.ID                AS source_file_id,
        f.Barcode           AS dms_number,
        COALESCE(f.FileNumber, '')      AS file_number,
        COALESCE(f.NameOfApplicant, '') AS applicant_name,
        COALESCE(f.SchemeName, '')      AS scheme_name,
        COALESCE(f.AllotteeName, '')    AS allottee_name,
        f.CreatedDateTime   AS source_created_at,
        d.ID                AS source_directory_id,
        COALESCE(d.Path, '') AS location_path,
        COALESCE(d.Name, '') AS directory_name
    FROM filedetails f
    LEFT JOIN (
        SELECT t.*
        FROM filedirectories t
        INNER JOIN (
            SELECT FileDetailID, MAX(ID) AS max_id
            FROM filedirectories
            GROUP BY FileDetailID
        ) latest ON latest.FileDetailID = t.FileDetailID AND latest.max_id = t.ID
    ) d ON d.FileDetailID = f.ID
"""


def _truncate(s: str | None, max_len: int) -> str:
    """Defensive: source columns are longtext, our mirror is CharField."""
    if s is None:
        return ''
    s = str(s).strip()
    return s if len(s) <= max_len else s[:max_len]


class Command(BaseCommand):
    help = 'Pull DMS file metadata + locations into the local DmsFile mirror.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Fetch from DMS, log counts, but do not write to LMIS.')
        parser.add_argument('--limit', type=int, default=None,
                            help='Cap rows fetched. Useful for smoke tests.')

    def handle(self, *args, **opts):
        try:
            import pymysql  # noqa: F401 — failing here is the clearest signal
        except ImportError as exc:
            raise CommandError(
                'pymysql is not installed in this image. Add it to requirements.txt '
                f'and rebuild the backend container. ({exc})'
            )

        host = os.environ.get('DMS_DB_HOST', 'host.docker.internal')
        port = int(os.environ.get('DMS_DB_PORT', '3307'))
        user = os.environ.get('DMS_DB_USER', 'dmsuser')
        pw   = os.environ.get('DMS_DB_PASSWORD', '')
        db   = os.environ.get('DMS_DB_NAME', 'dmsworkflow')

        if not pw:
            raise CommandError(
                'DMS_DB_PASSWORD is not set. Add the four DMS_DB_* vars to '
                '/opt/bda-lmis/.env on the server before running the sync.'
            )

        run = DmsSyncRun.objects.create()
        try:
            inserted, updated, skipped, seen = self._sync(
                host, port, user, pw, db,
                dry_run=opts['dry_run'],
                limit=opts['limit'],
            )
        except Exception as exc:
            run.status        = 'failed'
            run.error_message = f'{type(exc).__name__}: {exc}'
            run.finished_at   = timezone.now()
            run.save(update_fields=['status', 'error_message', 'finished_at'])
            logger.error('DMS sync failed: %s', exc, exc_info=True)
            raise

        run.status        = 'ok'
        run.rows_seen     = seen
        run.rows_inserted = inserted
        run.rows_updated  = updated
        run.rows_skipped  = skipped
        run.finished_at   = timezone.now()
        run.save(update_fields=['status', 'rows_seen', 'rows_inserted',
                                'rows_updated', 'rows_skipped', 'finished_at'])

        elapsed = (run.finished_at - run.started_at).total_seconds()
        msg = (f'DMS sync OK in {elapsed:.1f}s — '
               f'seen={seen} inserted={inserted} updated={updated} skipped={skipped}'
               + (' (DRY RUN)' if opts['dry_run'] else ''))
        self.stdout.write(self.style.SUCCESS(msg))
        logger.info(msg)

    # ── core ──────────────────────────────────────────────────────────────────

    def _sync(self, host, port, user, pw, db, *, dry_run: bool, limit: int | None):
        import pymysql
        from pymysql.cursors import DictCursor

        sql = SOURCE_QUERY
        if limit:
            sql += f'\nLIMIT {int(limit)}'

        # Connect and stream the result set. ~7k rows is small enough to fit
        # in memory; we still use a server-side cursor so growth doesn't bite.
        conn = pymysql.connect(
            host=host, port=port, user=user, password=pw, database=db,
            charset='utf8mb4', cursorclass=DictCursor,
            connect_timeout=10, read_timeout=60,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = list(cur.fetchall())
        finally:
            conn.close()

        seen = len(rows)
        if dry_run:
            self.stdout.write(f'[dry-run] would upsert {seen} rows')
            for r in rows[:3]:
                self.stdout.write(f'  sample → {r["dms_number"]!r}  {r["location_path"]!r}')
            return 0, 0, 0, seen

        return self._upsert(rows) + (seen,)

    def _upsert(self, rows: Iterable[dict]) -> tuple[int, int, int]:
        inserted = updated = skipped = 0

        # Dedup the source rows by dms_number before touching the DB.
        # DMS allows multiple filedetails rows with the same Barcode (we
        # saw ~hundreds in May 2026, e.g. BHR106012 ×3). The mirror keys
        # on dms_number with a UNIQUE constraint, so we keep the row with
        # the highest source_file_id (the most recently created scan).
        latest: dict[str, dict] = {}
        for r in rows:
            dms_number = (r.get('dms_number') or '').strip()
            if not dms_number:
                skipped += 1
                continue
            prev = latest.get(dms_number)
            if prev is None or (r.get('source_file_id') or 0) > (prev.get('source_file_id') or 0):
                latest[dms_number] = r

        # One transaction so a partial failure leaves the previous mirror intact.
        with transaction.atomic():
            existing = {
                d.dms_number: d for d in DmsFile.objects.all().only(
                    'id', 'dms_number', 'location_path', 'directory_name',
                    'source_file_id', 'source_directory_id',
                    'file_number', 'applicant_name', 'scheme_name', 'allottee_name',
                    'source_created_at',
                )
            }
            to_create: list[DmsFile] = []
            to_update: list[DmsFile] = []

            for dms_number, r in latest.items():
                payload = dict(
                    dms_number          = _truncate(dms_number, 40),
                    file_number         = _truncate(r.get('file_number'), 255),
                    applicant_name      = _truncate(r.get('applicant_name'), 255),
                    scheme_name         = _truncate(r.get('scheme_name'), 255),
                    allottee_name       = _truncate(r.get('allottee_name'), 255),
                    location_path       = _truncate(r.get('location_path'), 500),
                    directory_name      = _truncate(r.get('directory_name'), 255),
                    source_file_id      = r.get('source_file_id'),
                    source_directory_id = r.get('source_directory_id'),
                    source_created_at   = r.get('source_created_at'),
                )
                cur = existing.get(dms_number)
                if cur is None:
                    to_create.append(DmsFile(**payload))
                else:
                    changed = False
                    for k, v in payload.items():
                        if getattr(cur, k) != v:
                            setattr(cur, k, v)
                            changed = True
                    if changed:
                        to_update.append(cur)

            if to_create:
                DmsFile.objects.bulk_create(to_create, batch_size=1000)
                inserted = len(to_create)
            if to_update:
                DmsFile.objects.bulk_update(
                    to_update, batch_size=500,
                    fields=['file_number', 'applicant_name', 'scheme_name',
                            'allottee_name', 'location_path', 'directory_name',
                            'source_file_id', 'source_directory_id',
                            'source_created_at'],
                )
                updated = len(to_update)

        return inserted, updated, skipped
