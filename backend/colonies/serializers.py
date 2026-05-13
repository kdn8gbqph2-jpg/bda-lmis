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
            'layout_approval_date',
            'total_residential_plots', 'total_commercial_plots', 'total_plots',
            'has_map', 'available_map_formats',
        )


class ColonyDetailSerializer(serializers.ModelSerializer):
    """
    Full serializer for detail/create/update views — includes khasras and audit.
    """
    total_plots         = serializers.IntegerField(read_only=True)
    available_plots     = serializers.SerializerMethodField(read_only=True)
    patta_issued_count  = serializers.SerializerMethodField(read_only=True)
    colony_type_label   = serializers.CharField(source='get_colony_type_display', read_only=True)
    khasras             = KhasraListSerializer(many=True, read_only=True)
    # Write-only convenience field — accepts a comma-separated list of khasra
    # numbers and syncs Khasra rows for this colony in serializer.update().
    khasras_input       = serializers.CharField(
        write_only=True, required=False, allow_blank=True, allow_null=True,
    )
    updated_by_name     = serializers.SerializerMethodField()
    has_map             = serializers.BooleanField(read_only=True)
    available_map_formats = serializers.ListField(read_only=True)

    class Meta:
        model  = Colony
        fields = (
            # identity
            'id', 'name', 'colony_type', 'colony_type_label',
            'zone', 'chak_number', 'status',
            # survey
            'revenue_village', 'dlc_file_number', 'notified_area_bigha',
            # timeline
            'conversion_date', 'layout_approval_date',
            # notes
            'rejection_reason', 'remarks',
            # plots
            'total_residential_plots', 'total_commercial_plots',
            'total_plots_per_layout',
            'total_plots', 'available_plots', 'patta_issued_count',
            # map files
            'map_pdf', 'map_jpeg', 'map_png', 'map_svg', 'boundary_file',
            'has_map', 'available_map_formats',
            # related
            'khasras', 'khasras_input',
            # audit
            'created_at', 'updated_at', 'updated_by', 'updated_by_name',
        )
        read_only_fields = ('created_at', 'updated_at')

    def get_updated_by_name(self, obj):
        return obj.updated_by.get_full_name() if obj.updated_by else None

    def get_available_plots(self, obj):
        """Count of plots in this colony that have not yet been allotted."""
        try:
            from plots.models import Plot
            return Plot.objects.filter(colony=obj, status='available').count()
        except Exception:
            return 0

    def get_patta_issued_count(self, obj):
        """Count of pattas issued for this colony."""
        try:
            from pattas.models import Patta
            return Patta.objects.filter(colony=obj, status='issued').count()
        except Exception:
            return 0

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

    # ── khasras_input handling ───────────────────────────────────────────────

    @staticmethod
    def _parse_khasras_input(raw) -> list:
        """Accepts a comma/whitespace-separated string and returns deduped tokens."""
        if not raw:
            return []
        # Treat , and whitespace as separators; drop empties; preserve order; dedupe.
        seen, out = set(), []
        for tok in raw.replace('\n', ',').replace(';', ',').split(','):
            n = tok.strip()
            if n and n not in seen:
                seen.add(n)
                out.append(n)
        return out

    def _sync_khasras(self, colony, raw_input):
        if raw_input is None:
            return  # field omitted — leave khasras alone
        from .models import Khasra
        wanted = set(self._parse_khasras_input(raw_input))
        existing = {k.number: k for k in colony.khasras.all()}
        # Delete khasras not in the new list
        for number, k in existing.items():
            if number not in wanted:
                k.delete()
        # Create new khasras for numbers not yet present
        for number in wanted:
            if number not in existing:
                Khasra.objects.create(colony=colony, number=number)
        logger.info(
            'Colony %s khasras synced — kept %d, %d total wanted.',
            colony.pk, len(existing.keys() & wanted), len(wanted),
        )

    def create(self, validated_data):
        khasras_input = validated_data.pop('khasras_input', None)
        colony = super().create(validated_data)
        self._sync_khasras(colony, khasras_input)
        return colony

    def update(self, instance, validated_data):
        khasras_input = validated_data.pop('khasras_input', None)
        colony = super().update(instance, validated_data)
        self._sync_khasras(colony, khasras_input)
        return colony


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
            'layout_approval_date',
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
            'layout_approval_date',
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
