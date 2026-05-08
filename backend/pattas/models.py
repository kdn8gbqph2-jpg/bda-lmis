from django.db import models


PATTA_STATUS_CHOICES = [
    ('issued',     'Issued'),
    ('missing',    'Missing'),
    ('cancelled',  'Cancelled'),
    ('amended',    'Amended'),
    ('superseded', 'Superseded'),
]

ALLOTTEE_ROLE_CHOICES = [
    ('owner',     'Owner'),
    ('co-owner',  'Co-Owner'),
    ('legatee',   'Legatee'),
    ('heir',      'Heir'),
]

DOCUMENT_STATUS_CHOICES = [
    ('issued',   'Issued'),
    ('missing',  'Missing'),
    ('verified', 'Verified'),
]


class Patta(models.Model):
    """
    A patta (land deed) issued by BDA for one or more plots.

    Fields are sourced directly from the Excel ledger (Patta Ledger Format.xlsx):
      patta_number              ← Col G  (plain integer stored as string: "3498")
      colony                    ← sheet/tab name
      allottee_name             ← Col B
      allottee_address          ← Col C
      issue_date                ← Col H
      challan_number            ← Col I
      challan_date              ← Col J
      lease_amount              ← Col K
      lease_duration            ← Col L  (text, e.g. "10 वर्ष")
      regulation_file_present   ← Col M  (हाँ/नही → True/False/None)
      remarks                   ← Col O

    DMS file number (Col N) lives in documents_document, linked via
    document_id below.
    """

    patta_number            = models.CharField(max_length=50, unique=True,
                                               db_index=True,
                                               help_text='Plain integer from Excel, e.g. "3498"')
    colony                  = models.ForeignKey(
        'colonies.Colony',
        on_delete=models.PROTECT,
        related_name='pattas',
        db_index=True,
    )
    allottee_name           = models.CharField(max_length=255, db_index=True)
    allottee_address        = models.TextField(blank=True)
    issue_date              = models.DateField(null=True, blank=True)
    amendment_date          = models.DateField(null=True, blank=True)
    challan_number          = models.CharField(max_length=50, blank=True)
    challan_date            = models.DateField(null=True, blank=True)
    lease_amount            = models.DecimalField(max_digits=12, decimal_places=2,
                                                  null=True, blank=True)
    lease_duration          = models.CharField(max_length=30, blank=True,
                                               help_text='e.g. "10 वर्ष"')
    regulation_file_present = models.BooleanField(
        null=True, blank=True,
        help_text='हाँ → True, नही → False, blank → None (not recorded)',
    )
    status                  = models.CharField(max_length=30, choices=PATTA_STATUS_CHOICES,
                                               default='issued', db_index=True)
    document                = models.ForeignKey(
        'documents.Document',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='patta_set',
    )
    superseded_by           = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='supersedes',
        help_text='If status=superseded, points to the replacement patta',
    )
    remarks                 = models.TextField(blank=True)
    updated_by              = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_pattas',
    )
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'pattas_patta'
        ordering = ['colony', 'patta_number']
        indexes  = [
            models.Index(fields=['colony', 'status']),
            models.Index(fields=['allottee_name']),
        ]

    def __str__(self):
        return f'Patta {self.patta_number} – {self.allottee_name}'


class PlotPattaMapping(models.Model):
    """
    Junction table: one patta may cover multiple plots (common in BDA records).
    Also handles partial ownership (ownership_share_pct).
    """
    plot                = models.ForeignKey(
        'plots.Plot',
        on_delete=models.CASCADE,
        related_name='patta_mappings',
    )
    patta               = models.ForeignKey(
        Patta,
        on_delete=models.CASCADE,
        related_name='plot_mappings',
    )
    ownership_share_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=100.0,
        help_text='Share percentage this patta holds over this plot',
    )
    allottee_role       = models.CharField(max_length=50, choices=ALLOTTEE_ROLE_CHOICES,
                                           blank=True)
    document_status     = models.CharField(max_length=30, choices=DOCUMENT_STATUS_CHOICES,
                                           blank=True)
    notes               = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'pattas_plotpattamapping'
        unique_together = ('plot', 'patta')
        indexes         = [
            models.Index(fields=['plot']),
            models.Index(fields=['patta']),
        ]

    def __str__(self):
        return f'{self.patta.patta_number} ↔ {self.plot.plot_number} ({self.ownership_share_pct}%)'


class PattaVersion(models.Model):
    """
    Immutable snapshot of a Patta at each change.
    Created automatically via post_save signal (wired in apps.py).
    """
    patta      = models.ForeignKey(Patta, on_delete=models.CASCADE,
                                   related_name='versions')
    snapshot   = models.JSONField(help_text='Full serialized patta at this point in time')
    changed_by = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'pattas_pattaversion'
        ordering = ['-changed_at']

    def __str__(self):
        return f'v{self.pk} of Patta {self.patta.patta_number} @ {self.changed_at:%Y-%m-%d %H:%M}'
