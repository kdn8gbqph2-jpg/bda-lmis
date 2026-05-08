from rest_framework import serializers
from .models import Plot, PlotKhasraMapping


# ── PlotKhasraMapping ─────────────────────────────────────────────────────────

class PlotKhasraMappingSerializer(serializers.ModelSerializer):
    khasra_number = serializers.CharField(source='khasra.number', read_only=True)

    class Meta:
        model  = PlotKhasraMapping
        fields = ('id', 'khasra', 'khasra_number', 'intersection_area_sqm', 'notes')


# ── Plot list (lightweight) ───────────────────────────────────────────────────

class PlotListSerializer(serializers.ModelSerializer):
    colony_name           = serializers.CharField(source='colony.name', read_only=True)
    primary_khasra_number = serializers.CharField(source='primary_khasra.number',
                                                  read_only=True)

    class Meta:
        model  = Plot
        fields = (
            'id', 'plot_number', 'colony', 'colony_name',
            'primary_khasra', 'primary_khasra_number',
            'type', 'area_sqy', 'area_sqm', 'status',
        )


# ── Plot detail (full) ────────────────────────────────────────────────────────

class PlotDetailSerializer(serializers.ModelSerializer):
    colony_name           = serializers.CharField(source='colony.name', read_only=True)
    primary_khasra_number = serializers.CharField(source='primary_khasra.number',
                                                  read_only=True)
    khasra_mappings       = PlotKhasraMappingSerializer(many=True, read_only=True)

    class Meta:
        model  = Plot
        fields = (
            'id', 'plot_number',
            'colony', 'colony_name',
            'primary_khasra', 'primary_khasra_number',
            'type', 'area_sqy', 'area_sqm', 'status',
            'khasra_mappings',
            'geometry',
            'updated_by', 'created_at', 'updated_at',
        )
        read_only_fields = ('area_sqm', 'created_at', 'updated_at', 'updated_by')


# ── Plot write (create / update) ──────────────────────────────────────────────

class PlotWriteSerializer(serializers.ModelSerializer):
    """Accepts area_sqy (sqm is auto-computed on model.save)."""

    class Meta:
        model  = Plot
        fields = (
            'plot_number', 'colony', 'primary_khasra',
            'type', 'area_sqy', 'status', 'geometry',
        )

    def validate(self, attrs):
        # plot_number uniqueness is already enforced by the model
        colony  = attrs.get('colony')
        khasra  = attrs.get('primary_khasra')
        if colony and khasra and khasra.colony_id != colony.pk:
            raise serializers.ValidationError(
                {'primary_khasra': 'Primary khasra must belong to the selected colony.'}
            )
        return attrs


# ── GeoJSON serializers ───────────────────────────────────────────────────────

class PlotGeoJSONSerializer:
    """
    Static helper — mirrors the pattern used in colonies/serializers.py.
    Returns plain dicts (not DRF serializer instances) so they can be
    passed directly to Response() or cached in Redis.
    """

    STATUS_COLORS = {
        'available':          '#6B7280',   # gray
        'allotted_lottery':   '#3B82F6',   # blue
        'allotted_seniority': '#8B5CF6',   # violet
        'ews':                '#F59E0B',   # amber
        'patta_ok':           '#10B981',   # green
        'patta_missing':      '#EF4444',   # red
        'cancelled':          '#1F2937',   # dark
    }

    @classmethod
    def feature(cls, plot):
        """Single GeoJSON Feature for one plot."""
        geom = None
        if plot.geometry:
            import json
            geom = json.loads(plot.geometry.geojson)

        return {
            'type': 'Feature',
            'geometry': geom,
            'properties': {
                'id':           plot.id,
                'plot_number':  plot.plot_number,
                'colony_id':    plot.colony_id,
                'colony_name':  plot.colony.name,
                'type':         plot.type,
                'area_sqy':     float(plot.area_sqy) if plot.area_sqy else None,
                'area_sqm':     float(plot.area_sqm) if plot.area_sqm else None,
                'status':       plot.status,
                'color':        cls.STATUS_COLORS.get(plot.status, '#6B7280'),
            },
        }

    @classmethod
    def collection(cls, queryset):
        """FeatureCollection for a queryset of plots."""
        return {
            'type': 'FeatureCollection',
            'features': [cls.feature(p) for p in queryset],
        }
