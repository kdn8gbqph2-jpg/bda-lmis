"""
Local mirror of the relevant slice of the DMS workflow database that lives
on dmsserver. We don't read DMS at request time — a nightly Celery task
pulls all rows over an SSH tunnel into the table below, and the application
joins against this local copy for sub-millisecond lookups.

Schema mapping (source → mirror):

  dmsworkflow.filedetails
      ID                  → source_file_id  (PK on source side)
      Barcode             → dms_number      (e.g. "BHR104945")
      FileNumber          → file_number
      NameOfApplicant     → applicant_name
      SchemeName          → scheme_name
      AllotteeName        → allottee_name
      CreatedDateTime     → source_created_at

  dmsworkflow.filedirectories
      Path                → location_path   (e.g. "Y:\\Raw\\19-11-2025\\Regularization_BHR104945")
      Name                → directory_name

A single filedetails row can have multiple filedirectories rows; we pick
the most recent one (max ID) per FileDetailID, which corresponds to the
final QC'd / classified version of the scan.
"""

from django.db import models


class DmsFile(models.Model):
    """One row per DMS file (Barcode), keyed by dms_number for fast lookups."""

    dms_number          = models.CharField(
        max_length=40, unique=True, db_index=True,
        help_text='Barcode value from DMS — e.g. "BHR104945"',
    )
    file_number         = models.CharField(max_length=255, blank=True)
    department_name     = models.CharField(
        max_length=60, blank=True, db_index=True,
        help_text='Source masterdepartments.Name — required by DMS API to fetch the PDF.',
    )
    applicant_name      = models.CharField(max_length=255, blank=True)
    scheme_name         = models.CharField(max_length=255, blank=True)
    allottee_name       = models.CharField(max_length=255, blank=True)
    has_ns              = models.BooleanField(
        default=False,
        help_text='DMS has a "Notesheet Side" (noting) scan for this file.',
    )
    has_cs              = models.BooleanField(
        default=False,
        help_text='DMS has a "Correspondence Side" scan for this file.',
    )

    location_path       = models.CharField(
        max_length=500, blank=True,
        help_text='Filesystem path on the DMS scan drive (Windows-style).',
    )
    directory_name      = models.CharField(max_length=255, blank=True)
    source_file_id      = models.IntegerField(null=True, blank=True, db_index=True,
                                              help_text='filedetails.ID on the source DMS')
    source_directory_id = models.IntegerField(null=True, blank=True,
                                              help_text='filedirectories.ID on the source DMS')

    source_created_at   = models.DateTimeField(null=True, blank=True,
                                               help_text='filedetails.CreatedDateTime')
    refreshed_at        = models.DateTimeField(auto_now=True,
                                               help_text='Last time the sync touched this row')

    class Meta:
        db_table = 'dms_sync_file'
        ordering = ['dms_number']
        indexes  = [
            models.Index(fields=['file_number']),
            models.Index(fields=['applicant_name']),
        ]

    def __str__(self):
        return f'{self.dms_number} → {self.location_path or "(no path)"}'


class DmsSyncRun(models.Model):
    """
    One row per sync run for observability. Lets the admin see when the
    nightly job last succeeded, how many rows it touched, and what went
    wrong if it failed — without grepping container logs.
    """

    STATUS_CHOICES = [
        ('ok',     'OK'),
        ('failed', 'Failed'),
    ]

    started_at      = models.DateTimeField(auto_now_add=True)
    finished_at     = models.DateTimeField(null=True, blank=True)
    status          = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ok')
    rows_seen       = models.IntegerField(default=0,
                                          help_text='Rows fetched from source DMS')
    rows_inserted   = models.IntegerField(default=0)
    rows_updated    = models.IntegerField(default=0)
    rows_skipped    = models.IntegerField(default=0,
                                          help_text='Rows without a Barcode value')
    error_message   = models.TextField(blank=True)

    class Meta:
        db_table = 'dms_sync_run'
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.started_at:%Y-%m-%d %H:%M} — {self.status} ({self.rows_seen} rows)'
