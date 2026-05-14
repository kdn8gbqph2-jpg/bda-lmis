from django.contrib import admin

from .models import ChangeRequest


@admin.register(ChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'target_type', 'target_label', 'operation',
        'status', 'requested_by', 'requested_at',
        'resolved_by', 'resolved_at',
    )
    list_filter   = ('status', 'target_type', 'operation')
    search_fields = ('target_label', 'requested_by__username',
                     'requested_by__email', 'resolved_by__username')
    readonly_fields = ('requested_by', 'requested_at',
                       'resolved_by', 'resolved_at',
                       'payload', 'target_type', 'target_id', 'operation')
    ordering = ('-requested_at',)
