import json
from rest_framework import serializers
from .models import Colony, Khasra


# ── Khasra ───────────────────────────────────────────────────────────────────

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


# ── Colony ────────────────────────────────────────────────────────────────────

class ColonyListSerializer(serializers.ModelSerializer):
    total_plots = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Colony
        fields = (
            'id', 'name', 'zone', 'chak_number', 'status',
            'layout_approval_date',
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
        )


class ColonyDetailSerializer(serializers.ModelSerializer):
    total_plots  = serializers.IntegerField(read_only=True)
    khasras      = KhasraListSerializer(many=True, read_only=True)
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = Colony
        fields = (
            'id', 'name', 'zone', 'chak_number', 'status',
            'conversion_date', 'layout_approval_date',
            'dlc_file_number', 'notified_area_bigha',
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
            'khasras',
            'created_at', 'updated_at', 'updated_by', 'updated_by_name',
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None


class ColonyGeoJSONSerializer:
    """
    Produces a GeoJSON FeatureCollection from a Colony queryset.
    Used by the /geojson/ action — not a DRF serializer, just a helper.
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
                'name':   colony.name,
                'zone':   colony.zone,
                'status': colony.status,
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
