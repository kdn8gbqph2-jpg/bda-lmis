from rest_framework import serializers
from .models import ChangeRequest


class ChangeRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(read_only=True)
    resolved_by_name  = serializers.CharField(read_only=True)

    class Meta:
        model  = ChangeRequest
        # `payload` is included here (not just on the detail serializer)
        # because the per-record pending-CR lookups used by PendingBanner
        # and PendingFieldChip query the list endpoint and need the diff
        # data. Payloads are small JSON form snapshots — a few hundred
        # bytes per row — so the bell's paged list response stays light.
        fields = (
            'id',
            'target_type', 'target_id', 'target_label',
            'operation', 'status',
            'payload',
            'requested_by', 'requested_by_name', 'requested_at',
            'resolved_by',  'resolved_by_name',  'resolved_at',
            'resolution_notes',
        )


class ChangeRequestDetailSerializer(ChangeRequestListSerializer):
    """
    Same as the list payload + the request_notes and a snapshot of the
    target's current state so the reviewer can see exactly what is
    changing. `current` is null for create operations (nothing to diff
    against).
    """
    current = serializers.SerializerMethodField()

    class Meta(ChangeRequestListSerializer.Meta):
        fields = ChangeRequestListSerializer.Meta.fields + (
            'request_notes', 'current',
        )

    # Read-only fields we never want to show in the diff (they're either
    # derived, system-managed, or PKs of unrelated rows).
    _IGNORED_FIELDS = {
        'id', 'created_at', 'updated_at', 'updated_by',
        'full_name', 'colony_summary', 'plot_numbers',
        'plot_mappings', 'colony_name', 'colony_type_label',
        'has_map', 'available_map_formats', 'total_plots',
        'total_residential_plots', 'total_commercial_plots',
        'available_plots', 'patta_issued_count',
        'dms_file_path', 'dms_has_ns', 'dms_has_cs',
        'colony_type_label',
    }

    def get_current(self, obj):
        """
        Return a flat {field: value} dict of the current record state
        for `update` operations. Best-effort — if the target was
        deleted or the model doesn't exist, return null and let the
        UI render only the proposed payload.
        """
        if obj.operation != 'update' or obj.target_id is None:
            return None
        try:
            Model, Serializer = _resolver_for(obj.target_type)
            instance = Model.objects.get(pk=obj.target_id)
            data     = Serializer(instance).data
        except Exception:
            return None
        # Strip values that aren't useful for diffing.
        return {k: v for k, v in data.items() if k not in self._IGNORED_FIELDS}


def _resolver_for(target_type):
    """
    Mirror of approvals.views._resolver but using the *read* serializer
    where one exists, so the snapshot reflects the displayable shape
    (computed fields included).
    """
    if target_type == 'patta':
        from pattas.models      import Patta
        from pattas.serializers import PattaDetailSerializer
        return Patta, PattaDetailSerializer
    if target_type == 'colony':
        from colonies.models      import Colony
        from colonies.serializers import ColonyDetailSerializer
        return Colony, ColonyDetailSerializer
    if target_type == 'plot':
        from plots.models      import Plot
        from plots.serializers import PlotDetailSerializer
        return Plot, PlotDetailSerializer
    raise ValueError(f'Unsupported target_type: {target_type!r}')
