from django.contrib.gis.db import models as gis_models
from django.db import models
from decimal import Decimal


PLOT_TYPE_CHOICES = [
    ('Residential', 'Residential'),
    ('Commercial',  'Commercial'),
]

PLOT_STATUS_CHOICES = [
    ('available',          'Available'),
    ('allotted_lottery',   'Allotted – Lottery'),
    ('allotted_seniority', 'Allotted – Seniority'),
    ('ews',                'EWS'),
    ('patta_ok',           'Patta OK'),
    ('patta_missing',      'Patta Missing'),
    ('cancelled',          'Cancelled'),
]

SQY_TO_SQM = Decimal('0.836127')


class Plot(models.Model):
    """
    One physical plot within a colony.

    area_sqy  – raw value from Excel (वर्गगज / square yards)
    area_sqm  – derived from area_sqy on save (stored for fast querying)
    primary_khasra – always required; use PlotKhasraMapping only for the
                     ~5-10% of plots that physically cross a khasra boundary.
    """
    plot_number     = models.CharField(max_length=20, unique=True)
    colony          = models.ForeignKey(
        'colonies.Colony',
        on_delete=models.CASCADE,
        related_name='plots',
        db_index=True,
    )
    primary_khasra  = models.ForeignKey(
        'colonies.Khasra',
        on_delete=models.PROTECT,
        related_name='primary_plots',
        db_index=True,
    )
    type            = models.CharField(max_length=20, choices=PLOT_TYPE_CHOICES,
                                       default='Residential', db_index=True)
    area_sqy        = models.DecimalField(max_digits=10, decimal_places=2,
                                          null=True, blank=True,
                                          help_text='Area in square yards (from Excel)')
    area_sqm        = models.DecimalField(max_digits=10, decimal_places=2,
                                          null=True, blank=True,
                                          help_text='Area in sq m (auto-computed)')
    status          = models.CharField(max_length=30, choices=PLOT_STATUS_CHOICES,
                                       default='available', db_index=True)
    geometry        = gis_models.PolygonField(srid=4326, null=True, blank=True)
    updated_by      = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='updated_plots',
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table    = 'plots_plot'
        ordering    = ['colony', 'plot_number']
        indexes     = [
            models.Index(fields=['colony', 'status']),
            models.Index(fields=['colony', 'type']),
        ]

    def save(self, *args, **kwargs):
        # Auto-compute area_sqm from area_sqy
        if self.area_sqy is not None:
            self.area_sqm = (self.area_sqy * SQY_TO_SQM).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.plot_number} ({self.colony.name})'


class PlotKhasraMapping(models.Model):
    """
    Junction table for plots that physically cross khasra boundaries.
    Only needed for ~5-10% of plots.  The dominant khasra is stored as
    Plot.primary_khasra; this table records the secondary ones.
    """
    plot                  = models.ForeignKey(
        Plot,
        on_delete=models.CASCADE,
        related_name='khasra_mappings',
    )
    khasra                = models.ForeignKey(
        'colonies.Khasra',
        on_delete=models.CASCADE,
        related_name='plot_mappings',
    )
    intersection_area_sqm = models.DecimalField(max_digits=10, decimal_places=2,
                                                null=True, blank=True)
    geometry              = gis_models.PolygonField(srid=4326, null=True, blank=True)
    notes                 = models.TextField(blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'plots_plotkhasramapping'
        unique_together = ('plot', 'khasra')
        indexes         = [
            models.Index(fields=['plot']),
            models.Index(fields=['khasra']),
        ]

    def __str__(self):
        return f'{self.plot.plot_number} ↔ {self.khasra.number}'
