from rest_framework import serializers
from .models import Patta, PlotPattaMapping, PattaVersion


def _resolve_dms(patta):
    """
    Look up the DMS metadata for a patta via the joined Document and the
    nightly-synced DmsFile mirror.

    Returns (dms_number, dms_file_path) — either may be empty when there's
    no linked document, the doc has no DMS number, or the mirror hasn't
    been synced yet.
    """
    # Heavy import inside the function so app load order (pattas → documents
    # → dms_sync) stays loose.
    from dms_sync.models import DmsFile

    doc = getattr(patta, 'document', None)
    if not doc or not getattr(doc, 'dms_file_number', ''):
        return '', ''
    mirror = DmsFile.objects.filter(dms_number=doc.dms_file_number).only('location_path').first()
    return doc.dms_file_number, (mirror.location_path if mirror else '')


# ── PlotPattaMapping ──────────────────────────────────────────────────────────

class PlotPattaMappingSerializer(serializers.ModelSerializer):
    plot_number = serializers.CharField(source='plot.plot_number', read_only=True)
    colony_name = serializers.CharField(source='plot.colony.name', read_only=True)

    class Meta:
        model  = PlotPattaMapping
        fields = (
            'id', 'plot', 'plot_number', 'colony_name',
            'ownership_share_pct', 'allottee_role', 'document_status', 'notes',
        )


class PlotPattaMappingWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PlotPattaMapping
        fields = ('plot', 'ownership_share_pct', 'allottee_role', 'document_status', 'notes')


# ── PattaVersion ──────────────────────────────────────────────────────────────

class PattaVersionSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.email
        return None

    class Meta:
        model  = PattaVersion
        fields = ('id', 'changed_by', 'changed_by_name', 'changed_at', 'snapshot')


# ── Patta list (lightweight) ──────────────────────────────────────────────────

class PattaListSerializer(serializers.ModelSerializer):
    colony_name    = serializers.CharField(source='colony.name', read_only=True)
    plot_count     = serializers.SerializerMethodField()
    dms_file_number = serializers.CharField(
        source='document.dms_file_number', read_only=True, allow_null=True, default='',
    )
    dms_file_path  = serializers.SerializerMethodField()

    def get_plot_count(self, obj):
        return obj.plot_mappings.count()

    def get_dms_file_path(self, obj):
        _, path = _resolve_dms(obj)
        return path

    class Meta:
        model  = Patta
        fields = (
            'id', 'patta_number', 'colony', 'colony_name',
            'allottee_name', 'issue_date', 'status',
            'regulation_file_present', 'plot_count',
            'dms_file_number', 'dms_file_path',
        )


# ── Patta detail (full) ───────────────────────────────────────────────────────

class PattaDetailSerializer(serializers.ModelSerializer):
    colony_name   = serializers.CharField(source='colony.name', read_only=True)
    plot_mappings = PlotPattaMappingSerializer(many=True, read_only=True)
    superseded_by_number = serializers.CharField(
        source='superseded_by.patta_number', read_only=True, allow_null=True,
    )
    # Lightweight summary of the parent colony — zone, revenue_village and
    # the colony's khasra numbers — exposed read-only so the edit modal can
    # display them alongside the patta fields without a second API call.
    colony_summary  = serializers.SerializerMethodField()
    plot_numbers    = serializers.SerializerMethodField()
    dms_file_number = serializers.CharField(
        source='document.dms_file_number', read_only=True, allow_null=True, default='',
    )
    dms_file_path   = serializers.SerializerMethodField()

    def get_dms_file_path(self, obj):
        _, path = _resolve_dms(obj)
        return path

    def get_colony_summary(self, obj):
        if not obj.colony_id:
            return None
        c = obj.colony
        return {
            'id':              c.id,
            'name':            c.name,
            'zone':            c.zone,
            'revenue_village': c.revenue_village or '',
            'khasras':         list(c.khasras.values_list('number', flat=True).order_by('number')),
        }

    def get_plot_numbers(self, obj):
        return [pm.plot.plot_number for pm in obj.plot_mappings.all() if pm.plot]

    class Meta:
        model  = Patta
        fields = (
            'id', 'patta_number',
            'colony', 'colony_name', 'colony_summary',
            'allottee_name', 'allottee_address',
            'issue_date', 'amendment_date',
            'challan_number', 'challan_date',
            'lease_amount', 'lease_duration',
            'regulation_file_present',
            'status',
            'document',
            'superseded_by', 'superseded_by_number',
            'remarks',
            'plot_mappings', 'plot_numbers',
            'dms_file_number', 'dms_file_path',
            'updated_by', 'created_at', 'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at', 'updated_by')


# ── Patta write (create / update) ─────────────────────────────────────────────

class PattaWriteSerializer(serializers.ModelSerializer):
    """
    Accepts:
      - All scalar patta fields
      - plots: [{plot_id, ownership_share_pct, allottee_role, document_status, notes}]
        → written to PlotPattaMapping (replaces existing mappings on update)
    """
    plots = PlotPattaMappingWriteSerializer(many=True, required=False, write_only=True)

    class Meta:
        model  = Patta
        fields = (
            'patta_number', 'colony',
            'allottee_name', 'allottee_address',
            'issue_date', 'amendment_date',
            'challan_number', 'challan_date',
            'lease_amount', 'lease_duration',
            'regulation_file_present',
            'status', 'document', 'superseded_by', 'remarks',
            'plots',
        )

    def _save_plots(self, patta, plots_data):
        if plots_data is None:
            return
        # Replace all mappings on update / create
        PlotPattaMapping.objects.filter(patta=patta).delete()
        for item in plots_data:
            PlotPattaMapping.objects.create(patta=patta, **item)

    def create(self, validated_data):
        plots_data = validated_data.pop('plots', None)
        patta      = super().create(validated_data)
        self._save_plots(patta, plots_data)
        return patta

    def update(self, instance, validated_data):
        plots_data = validated_data.pop('plots', None)
        patta      = super().update(instance, validated_data)
        self._save_plots(patta, plots_data)
        return patta

    def validate(self, attrs):
        # When superseding another patta, status must be 'superseded'
        if attrs.get('superseded_by') and attrs.get('status') != 'superseded':
            raise serializers.ValidationError(
                {'status': 'Status must be "superseded" when superseded_by is set.'}
            )
        return attrs
