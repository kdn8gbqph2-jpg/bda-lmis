from django.contrib.gis.db import models as gis_models
from django.db import models


LAYER_TYPE_CHOICES = [
    ('WATER',       'Water'),
    ('SEWERAGE',    'Sewerage'),
    ('ELECTRICITY', 'Electricity'),
    ('ROADS',       'Roads'),
    ('DRAINAGE',    'Drainage'),
    ('OTHER',       'Other'),
]


class CustomLayer(models.Model):
    """
    A named GIS utility layer (water, sewerage, roads, etc.)
    uploaded as GeoJSON or Shapefile by staff.

    `geometry` holds the full collection.  Individual features are also
    stored in `LayerFeature` for feature-level property queries.

    `style` JSONB controls rendering on the frontend map:
      {stroke_color, stroke_width, fill_color, opacity}
    """
    name         = models.CharField(max_length=255)
    layer_type   = models.CharField(max_length=30, choices=LAYER_TYPE_CHOICES,
                                    db_index=True)
    geometry     = gis_models.GeometryCollectionField(srid=4326, null=True, blank=True)
    style        = models.JSONField(
        default=dict, blank=True,
        help_text='Rendering style: {stroke_color, stroke_width, fill_color, opacity}',
    )
    colony       = models.ForeignKey(
        'colonies.Colony',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='gis_layers',
    )
    source_file  = models.CharField(max_length=255, blank=True,
                                    help_text='Original uploaded filename')
    is_public    = models.BooleanField(default=True, db_index=True)
    metadata     = models.JSONField(
        default=dict, blank=True,
        help_text='{source, last_verified, responsible_officer, notes}',
    )
    created_by   = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.PROTECT,
        related_name='created_layers',
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gis_customlayer'
        ordering = ['layer_type', 'name']

    def __str__(self):
        return f'{self.get_layer_type_display()} — {self.name}'


class BasemapSource(models.Model):
    """
    A user-imported raster tile basemap. Stored as a {z}/{x}/{y} URL
    template plus attribution + zoom cap. Selectable from the map page
    alongside the four built-in keyless basemaps.

    The URL template must contain literal `{z}`, `{x}`, `{y}` placeholders
    (validated at the serializer level). Subdomain placeholders like
    `{s}` aren't supported here — list each subdomain as a separate
    URL by uploading a comma-separated value to `url_template` if needed,
    or just pick a single subdomain.
    """
    name           = models.CharField(max_length=120, unique=True)
    url_template   = models.CharField(
        max_length=500,
        help_text='Tile URL with {z}/{x}/{y} placeholders.',
    )
    attribution    = models.CharField(max_length=255, blank=True)
    max_zoom       = models.PositiveSmallIntegerField(default=19)
    created_by     = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.PROTECT,
        related_name='created_basemaps',
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gis_basemapsource'
        ordering = ['name']

    def __str__(self):
        return self.name


class LayerFeature(models.Model):
    """
    Individual feature within a CustomLayer.
    `properties` holds attribute data from the original source
    (e.g. pipe diameter, material, depth for water lines).
    """
    custom_layer = models.ForeignKey(
        CustomLayer,
        on_delete=models.CASCADE,
        related_name='features',
    )
    feature_id   = models.CharField(max_length=100, blank=True, db_index=True,
                                    help_text='e.g. "WL-001"')
    geometry     = gis_models.GeometryField(srid=4326)
    properties   = models.JSONField(default=dict, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'gis_layerfeature'
        indexes  = [
            models.Index(fields=['custom_layer']),
        ]

    def __str__(self):
        return f'{self.feature_id or self.pk} in {self.custom_layer}'
