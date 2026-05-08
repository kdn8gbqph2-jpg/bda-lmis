from rest_framework import serializers
from .models import Patta, PlotPattaMapping, PattaVersion


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
    colony_name  = serializers.CharField(source='colony.name', read_only=True)
    plot_count   = serializers.SerializerMethodField()

    def get_plot_count(self, obj):
        return obj.plot_mappings.count()

    class Meta:
        model  = Patta
        fields = (
            'id', 'patta_number', 'colony', 'colony_name',
            'allottee_name', 'issue_date', 'status',
            'regulation_file_present', 'plot_count',
        )


# ── Patta detail (full) ───────────────────────────────────────────────────────

class PattaDetailSerializer(serializers.ModelSerializer):
    colony_name   = serializers.CharField(source='colony.name', read_only=True)
    plot_mappings = PlotPattaMappingSerializer(many=True, read_only=True)
    superseded_by_number = serializers.CharField(
        source='superseded_by.patta_number', read_only=True, allow_null=True,
    )

    class Meta:
        model  = Patta
        fields = (
            'id', 'patta_number',
            'colony', 'colony_name',
            'allottee_name', 'allottee_address',
            'issue_date', 'amendment_date',
            'challan_number', 'challan_date',
            'lease_amount', 'lease_duration',
            'regulation_file_present',
            'status',
            'document',
            'superseded_by', 'superseded_by_number',
            'remarks',
            'plot_mappings',
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
