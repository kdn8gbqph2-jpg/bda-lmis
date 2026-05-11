import logging

from django.contrib.gis.db import models as gis_models
from django.db import models

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────────────

COLONY_TYPE_CHOICES = [
    ('bda_scheme',        'BDA Scheme'),
    ('private_approved',  'Private Approved Colony'),
    ('suo_moto',          'SUO-Moto Colony Case'),
    ('pending_layout',    'Pending Colony Layout'),
    ('rejected_layout',   'Rejected Colony Layout'),
]

ZONE_CHOICES = [
    ('North',      'North'),
    ('South',      'South'),
    ('East',       'East'),
    ('West',       'West'),
    ('Central',    'Central'),
    ('North-East', 'North-East'),
    ('South-East', 'South-East'),
    ('South-West', 'South-West'),
]

STATUS_CHOICES = [
    ('active',   'Active'),
    ('new',      'New'),
    ('archived', 'Archived'),
]

# Allowed map upload extensions (enforced at serializer/view level)
MAP_UPLOAD_EXTENSIONS = ['pdf', 'svg', 'png']


# ── Colony ────────────────────────────────────────────────────────────────────

class Colony(models.Model):
    """
    Represents a BDA colony or layout.

    colony_type determines which public dashboard category it appears in.
    rejection_reason is only meaningful when colony_type == 'rejected_layout'.
    Map files (map_pdf, map_svg, map_png) are uploaded by staff; any/all
    may be None when not yet scanned/uploaded.
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    name        = models.CharField(max_length=200, unique=True)
    colony_type = models.CharField(
        max_length=30,
        choices=COLONY_TYPE_CHOICES,
        default='bda_scheme',
        db_index=True,
        help_text='Category shown on the public dashboard.',
    )
    zone   = models.CharField(max_length=50, choices=ZONE_CHOICES, default='Central')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # ── Survey / revenue ──────────────────────────────────────────────────────
    chak_number         = models.IntegerField(null=True, blank=True)   # चक नम्बर
    dlc_file_number     = models.CharField(max_length=100, unique=True, null=True, blank=True)
    notified_area_bigha = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # ── Timeline ──────────────────────────────────────────────────────────────
    conversion_date          = models.DateField(null=True, blank=True)
    layout_application_date  = models.DateField(
        null=True, blank=True,
        help_text='Date on which the layout plan was submitted for approval.',
    )
    layout_approval_date     = models.DateField(
        null=True, blank=True,
        help_text='Date on which the layout plan was formally approved.',
    )

    # ── Rejection / notes ─────────────────────────────────────────────────────
    rejection_reason = models.TextField(
        blank=True,
        help_text='Populated only for rejected_layout colonies. '
                  'Visible on public dashboard.',
    )
    remarks = models.TextField(
        blank=True,
        help_text='Internal or public notes about this colony.',
    )

    # ── Plot counts ───────────────────────────────────────────────────────────
    total_residential_plots = models.IntegerField(default=0)
    total_commercial_plots  = models.IntegerField(default=0)

    # ── Geometry ──────────────────────────────────────────────────────────────
    boundary = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)

    # ── Uploaded map files ────────────────────────────────────────────────────
    map_pdf = models.FileField(
        upload_to='colony_maps/pdf/', null=True, blank=True,
        help_text='Uploaded PDF copy of the colony layout plan.',
    )
    map_svg = models.FileField(
        upload_to='colony_maps/svg/', null=True, blank=True,
        help_text='Uploaded SVG version of the colony boundary map.',
    )
    map_png = models.FileField(
        upload_to='colony_maps/png/', null=True, blank=True,
        help_text='Uploaded PNG thumbnail of the colony layout plan.',
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        'users.CustomUser', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='updated_colonies',
    )

    class Meta:
        db_table        = 'colonies_colony'
        verbose_name    = 'Colony'
        verbose_name_plural = 'Colonies'
        ordering        = ['name']
        indexes = [
            models.Index(fields=['zone']),
            models.Index(fields=['status']),
            models.Index(fields=['colony_type']),   # used by public dashboard filter
        ]

    def __str__(self):
        return f'{self.name} ({self.get_colony_type_display()})'

    # ── Computed properties ───────────────────────────────────────────────────

    @property
    def total_plots(self):
        return self.total_residential_plots + self.total_commercial_plots

    @property
    def has_map(self):
        """True if at least one map file has been uploaded."""
        return bool(self.map_pdf or self.map_svg or self.map_png)

    @property
    def available_map_formats(self):
        """Returns list of uploaded format strings, e.g. ['pdf', 'png']."""
        formats = []
        if self.map_pdf:
            formats.append('pdf')
        if self.map_svg:
            formats.append('svg')
        if self.map_png:
            formats.append('png')
        return formats

    # ── Business logic ────────────────────────────────────────────────────────

    def save(self, *args, **kwargs):
        """
        Clear rejection_reason when colony_type changes away from rejected_layout,
        to avoid stale data being surfaced publicly.
        """
        if self.colony_type != 'rejected_layout' and self.rejection_reason:
            logger.info(
                'Colony %s type changed from rejected_layout; clearing rejection_reason.',
                self.pk,
            )
            self.rejection_reason = ''
        super().save(*args, **kwargs)


# ── Khasra ────────────────────────────────────────────────────────────────────

class Khasra(models.Model):
    """
    Individual khasra (revenue plot) parcel that makes up a colony's land area.
    A colony has one or more khasras; a khasra belongs to exactly one colony.
    """

    colony      = models.ForeignKey(Colony, on_delete=models.CASCADE, related_name='khasras')
    number      = models.CharField(max_length=50)       # e.g. "112/1", "1450/1887"
    total_bigha = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    geometry    = gis_models.PolygonField(srid=4326, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'colonies_khasra'
        verbose_name    = 'Khasra'
        verbose_name_plural = 'Khasras'
        unique_together = ('colony', 'number')
        ordering        = ['colony', 'number']
        indexes = [
            models.Index(fields=['colony']),
        ]

    def __str__(self):
        return f'{self.colony.name} / Khasra {self.number}'
