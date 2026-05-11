import logging
import json

from rest_framework import serializers

from .models import Colony, Khasra, COLONY_TYPE_CHOICES

logger = logging.getLogger(__name__)


# ── Khasra ────────────────────────────────────────────────────────────────────

class KhasraListSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Khasra
        fields = ('id', 'number', 'total_bigha')


class KhasraDetailSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)

    class Meta:
        model  = Khasra
        fields = (
            'id', 'colony', 'colony_name',
            'number', 'total_bigha',
            'created_at', 'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')


# ── Colony — Staff serializers ────────────────────────────────────────────────

class ColonyListSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for list views — no khasras, no geometry.
    Includes colony_type for staff filtering.
    """
    total_plots       = serializers.IntegerField(read_only=True)
    colony_type_label = serializers.CharField(source='get_colony_type_display', read_only=True)

    class Meta:
        model  = Colony
        fields = (
            'id', 'name', 'colony_type', 'colony_type_label',
            'zone', 'chak_number', 'status',
            'layout_application_date', 'layout_approval_date',
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
            'has_map', 'available_map_formats',
        )


class ColonyDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for detail/create/update views — includes khasras and audit.
    """
    total_plots        = serializers.IntegerField(read_only=True)
    colony_type_label  = serializers.CharField(source='get_colony_type_display', read_only=True)
    khasras            = KhasraListSerializer(many=True, read_only=True)
    updated_by_name    = serializers.SerializerMethodField()
    has_map            = serializers.BooleanField(read_only=True)
    available_map_formats = serializers.ListField(read_only=True)

    class Meta:
        model  = Colony
        fields = (
            # identity
            'id', 'name', 'colony_type', 'colony_type_label',
            'zone', 'chak_number', 'status',
            # survey
            'dlc_file_number', 'notified_area_bigha',
            # timeline
            'conversion_date', 'layout_application_date', 'layout_approval_date',
            # notes
            'rejection_reason', 'remarks',
            # plots
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
            # map files
            'map_pdf', 'map_svg', 'map_png', 'has_map', 'available_map_formats',
            # related
            'khasras',
            # audit
            'created_at', 'updated_at', 'updated_by', 'updated_by_name',
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None

    def validate(self, attrs):
        """
        Enforce: rejection_reason is required when colony_type is rejected_layout.
        """
        colony_type      = attrs.get('colony_type', getattr(self.instance, 'colony_type', None))
        rejection_reason = attrs.get('rejection_reason', getattr(self.instance, 'rejection_reason', ''))

        if colony_type == 'rejected_layout' and not rejection_reason:
            raise serializers.ValidationError({
                'rejection_reason': 'Rejection reason is required for rejected layout colonies.',
            })
        return attrs


# ── Colony — Public serializers ───────────────────────────────────────────────

class PublicKhasraSerializer(serializers.ModelSerializer):
    """
    Read-only khasra info for public API — no internal IDs exposed.
    """
    class Meta:
        model  = Khasra
        fields = ('number', 'total_bigha')


class PublicColonyListSerializer(serializers.ModelSerializer):
    """
    Minimal read-only colony data for the public dashboard list view.
    Excludes internal fields (chak_number, dlc_file_number, updated_by, etc.).
    """
    colony_type_label = serializers.CharField(source='get_colony_type_display', read_only=True)
    total_plots       = serializers.IntegerField(read_only=True)
    has_map           = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Colony
        fields = (
            'id', 'name', 'colony_type', 'colony_type_label', 'zone',
            'layout_application_date', 'layout_approval_date',
            'total_plots', 'has_map',
        )


class PublicColonyDetailSerializer(serializers.ModelSerializer):
    """
    Full read-only colony detail for public pages.
    Includes khasra list and available map formats.
    Excludes staff-only fields (dlc_file_number, updated_by, etc.).
    """
    colony_type_label     = serializers.CharField(source='get_colony_type_display', read_only=True)
    total_plots           = serializers.IntegerField(read_only=True)
    khasras               = PublicKhasraSerializer(many=True, read_only=True)
    has_map               = serializers.BooleanField(read_only=True)
    available_map_formats = serializers.ListField(read_only=True)

    class Meta:
        model  = Colony
        fields = (
            'id', 'name', 'colony_type', 'colony_type_label', 'zone',
            'layout_application_date', 'layout_approval_date',
            'rejection_reason', 'remarks',
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
            'khasras',
            'has_map', 'available_map_formats',
        )


# ── GeoJSON helpers ───────────────────────────────────────────────────────────

class ColonyGeoJSONSerializer:
    """
    Produces a GeoJSON FeatureCollection from a Colony queryset.
    Not a DRF serializer — used directly by the /geojson/ action.
    """

    @staticmethod
    def feature(colony):
        boundary_geojson = (
            json.loads(colony.boundary.geojson) if colony.boundary else None
        )
        return {
            'type': 'Feature',
            'id':   colony.pk,
            'geometry': boundary_geojson,
            'properties': {
                'name':        colony.name,
                'colony_type': colony.colony_type,
                'zone':        colony.zone,
                'status':      colony.status,
                'total_plots': colony.total_plots,
            },
        }

    @classmethod
    def collection(cls, queryset):
        return {
            'type':     'FeatureCollection',
            'features': [cls.feature(c) for c in queryset],
        }


class KhasraGeoJSONSerializer:
    """GeoJSON helper for Khasra queryset."""

    @staticmethod
    def feature(khasra):
        geom = json.loads(khasra.geometry.geojson) if khasra.geometry else None
        return {
            'type': 'Feature',
            'id':   khasra.pk,
            'geometry': geom,
            'properties': {
                'number':      khasra.number,
                'colony_id':   khasra.colony_id,
                'colony_name': khasra.colony.name,
                'total_bigha': float(khasra.total_bigha) if khasra.total_bigha else None,
            },
        }

    @classmethod
    def collection(cls, queryset):
        return {
            'type':     'FeatureCollection',
            'features': [cls.feature(k) for k in queryset.select_related('colony')],
        }
