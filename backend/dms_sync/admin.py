from django.contrib import admin

from .models import DmsFile, DmsSyncRun


@admin.register(DmsFile)
class DmsFileAdmin(admin.ModelAdmin):
    list_display  = ('dms_number', 'applicant_name', 'location_path', 'refreshed_at')
    search_fields = ('dms_number', 'file_number', 'applicant_name', 'allottee_name', 'location_path')
    readonly_fields = ('refreshed_at',)
    ordering      = ('dms_number',)


@admin.register(DmsSyncRun)
class DmsSyncRunAdmin(admin.ModelAdmin):
    list_display  = ('started_at', 'status', 'rows_seen', 'rows_inserted', 'rows_updated',
                     'rows_skipped', 'finished_at')
    list_filter   = ('status',)
    readonly_fields = ('started_at', 'finished_at', 'status', 'rows_seen', 'rows_inserted',
                       'rows_updated', 'rows_skipped', 'error_message')
    ordering      = ('-started_at',)

    # This is a runtime telemetry table — operators shouldn't be hand-editing it.
    def has_add_permission(self, request):     return False
    def has_change_permission(self, request, obj=None): return False
