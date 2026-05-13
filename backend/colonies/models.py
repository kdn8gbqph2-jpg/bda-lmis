import logging

from django.contrib.gis.db import models as gis_models
from django.db import models

logger = logging.getLogger(__name__)


# ── Constants ─────────────────────────────────────────────────────────────────

COLONY_TYPE_CHOICES = [
    ('bda_scheme',        'BDA Scheme'),
    ('private_approved',  'BDA Approved'),
    # NOTE: stored value stays 'suo_moto' for back-compat with the
    # public URL/query param and audit-log history. Only the human
    # label was renamed when the authority adopted the "Regularized
    # Colonies" branding for these cases.
    ('suo_moto',          'Regularized Colonies'),
    ('pending_layout',    'Pending Layout Approval'),
    ('rejected_layout',   'Rejected Layout'),
]

ZONE_CHOICES = [
    ('East', 'East'),
    ('West', 'West'),
]

STATUS_CHOICES = [
    ('active',   'Active'),
    ('new',      'New'),
    ('archived', 'Archived'),
]

# Allowed map upload extensions (enforced at serializer/view level)
MAP_UPLOAD_EXTENSIONS = ['pdf', 'jpeg', 'jpg', 'png', 'svg']


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
    zone   = models.CharField(max_length=20, choices=ZONE_CHOICES, default='East')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    # ── Survey / revenue ──────────────────────────────────────────────────────
    chak_number         = models.IntegerField(null=True, blank=True)   # चक नम्बर
    revenue_village     = models.CharField(
        max_length=200, blank=True,
        help_text='Source: Excel row 2 "ग्राम का नाम" (revenue village name).',
    )
    dlc_file_number     = models.CharField(max_length=100, unique=True, null=True, blank=True)
    notified_area_bigha = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    # ── Timeline ──────────────────────────────────────────────────────────────
    conversion_date          = models.DateField(null=True, blank=True)
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
    # Source-of-truth total from the Excel layout-plan header
    # ("लेआउट प्लान अनुसार कुल भुखण्डों की संख्या"). When set, this overrides
    # the residential+commercial sum exposed by the total_plots property.
    total_plots_per_layout  = models.IntegerField(null=True, blank=True)

    # ── Geometry ──────────────────────────────────────────────────────────────
    boundary = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)

    # ── Uploaded map files ────────────────────────────────────────────────────
    map_pdf = models.FileField(
        upload_to='colony_maps/pdf/', null=True, blank=True,
        help_text='Uploaded PDF copy of the colony layout plan.',
    )
    map_jpeg = models.FileField(
        upload_to='colony_maps/jpeg/', null=True, blank=True,
        help_text='Uploaded JPEG of the colony layout plan.',
    )
    map_png = models.FileField(
        upload_to='colony_maps/png/', null=True, blank=True,
        help_text='Uploaded PNG of the colony layout plan.',
    )
    map_svg = models.FileField(
        upload_to='colony_maps/svg/', null=True, blank=True,
        help_text='Uploaded SVG version of the colony boundary map.',
    )
    boundary_file = models.FileField(
        upload_to='colony_maps/boundary/', null=True, blank=True,
        help_text='Source KML or shapefile (.kml/.zip) used to derive boundary geometry.',
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
        """Prefer the Excel-sourced layout total; fall back to the
        residential+commercial sum for colonies edited manually."""
        if self.total_plots_per_layout is not None:
            return self.total_plots_per_layout
        return self.total_residential_plots + self.total_commercial_plots

    @property
    def has_map(self):
        """True if at least one map file has been uploaded."""
        return bool(self.map_pdf or self.map_jpeg or self.map_png or self.map_svg)

    @property
    def available_map_formats(self):
        """Returns list of uploaded format strings, e.g. ['pdf', 'png']."""
        formats = []
        if self.map_pdf:  formats.append('pdf')
        if self.map_jpeg: formats.append('jpeg')
        if self.map_png:  formats.append('png')
        if self.map_svg:  formats.append('svg')
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
