from django.db import models


DOCUMENT_TYPE_CHOICES = [
    ('patta',     'Patta'),
    ('survey',    'Survey'),
    ('mutation',  'Mutation'),
    ('amendment', 'Amendment'),
    ('other',     'Other'),
]

DOCUMENT_STATUS_CHOICES = [
    ('uploaded', 'Uploaded'),
    ('verified', 'Verified'),
    ('linked',   'Linked'),
]

FILE_TYPE_CHOICES = [
    ('pdf', 'PDF'),
    ('jpg', 'JPEG'),
    ('png', 'PNG'),
]


class Document(models.Model):
    """
    Scanned document (patta, survey, mutation, amendment, etc.).

    DMS file number (Column N in Excel, format BHR102703) is stored in
    `dms_file_number` for cross-reference with the physical DMS system.

    Storage: local `media/documents/` in development; S3 when USE_S3=True.
    Django's DEFAULT_FILE_STORAGE handles the backend transparently.

    7-year government retention rule: hard-delete is never allowed.
    Use status=cancelled or simply leave as is.  Views enforce this.
    """

    original_filename = models.CharField(max_length=255)
    file              = models.FileField(
        upload_to='documents/%Y/%m/',
        help_text='Stored via DEFAULT_FILE_STORAGE (local or S3)',
    )
    file_size_bytes   = models.PositiveIntegerField(null=True, blank=True)
    file_type         = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES,
                                         blank=True)
    mime_type         = models.CharField(max_length=60, blank=True)
    document_type     = models.CharField(max_length=30, choices=DOCUMENT_TYPE_CHOICES,
                                         default='patta', db_index=True)
    dms_file_number   = models.CharField(
        max_length=20, blank=True, db_index=True,
        help_text='DMS reference, e.g. BHR102703 (from Excel Col N)',
    )

    # Optional links to domain objects (both nullable — a doc may exist before linking)
    linked_plot  = models.ForeignKey(
        'plots.Plot',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents',
    )
    linked_patta = models.ForeignKey(
        'pattas.Patta',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='documents',
    )

    status       = models.CharField(max_length=30, choices=DOCUMENT_STATUS_CHOICES,
                                    default='uploaded', db_index=True)
    uploaded_by  = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.PROTECT,
        related_name='uploaded_documents',
    )
    uploaded_at  = models.DateTimeField(auto_now_add=True)
    verified_by  = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='verified_documents',
    )
    verified_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'documents_document'
        ordering = ['-uploaded_at']
        indexes  = [
            models.Index(fields=['linked_plot']),
            models.Index(fields=['linked_patta']),
            models.Index(fields=['document_type', 'status']),
        ]

    def __str__(self):
        return f'{self.dms_file_number or self.original_filename} ({self.document_type})'

    @property
    def file_url(self):
        """Absolute URL or S3 presigned URL depending on storage backend."""
        try:
            return self.file.url
        except Exception:
            return None
