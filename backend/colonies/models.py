from django.contrib.gis.db import models as gis_models
from django.db import models


class Colony(models.Model):

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

    name                    = models.CharField(max_length=200, unique=True)
    zone                    = models.CharField(max_length=50, choices=ZONE_CHOICES, default='Central')
    chak_number             = models.IntegerField(null=True, blank=True)          # चक नम्बर from Excel row 3
    status                  = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    conversion_date         = models.DateField(null=True, blank=True)
    layout_approval_date    = models.DateField(null=True, blank=True)             # Excel row 4
    dlc_file_number         = models.CharField(max_length=100, unique=True, null=True, blank=True)
    notified_area_bigha     = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_residential_plots = models.IntegerField(default=0)
    total_commercial_plots  = models.IntegerField(default=0)
    boundary                = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    updated_by              = models.ForeignKey(
        'users.CustomUser', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='updated_colonies'
    )

    class Meta:
        db_table        = 'colonies_colony'
        verbose_name_plural = 'colonies'
        ordering        = ['name']
        indexes = [
            models.Index(fields=['zone']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.name

    @property
    def total_plots(self):
        return self.total_residential_plots + self.total_commercial_plots


class Khasra(models.Model):

    colony      = models.ForeignKey(Colony, on_delete=models.CASCADE, related_name='khasras')
    number      = models.CharField(max_length=50)       # e.g. "112/1", "1450/1887", "1829"
    total_bigha = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    geometry    = gis_models.PolygonField(srid=4326, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table        = 'colonies_khasra'
        unique_together = ('colony', 'number')
        ordering        = ['colony', 'number']
        indexes = [
            models.Index(fields=['colony']),
        ]

    def __str__(self):
        return f'{self.colony.name} / Khasra {self.number}'
