from django.contrib import admin
from .models import Patta, PlotPattaMapping, PattaVersion


class PlotPattaMappingInline(admin.TabularInline):
    model   = PlotPattaMapping
    extra   = 0
    fields  = ('plot', 'ownership_share_pct', 'allottee_role', 'document_status', 'notes')


class PattaVersionInline(admin.TabularInline):
    model   = PattaVersion
    extra   = 0
    fields  = ('changed_by', 'changed_at')
    readonly_fields = ('changed_by', 'changed_at', 'snapshot')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Patta)
class PattaAdmin(admin.ModelAdmin):
    inlines       = (PlotPattaMappingInline, PattaVersionInline)
    list_display  = (
        'patta_number', 'colony', 'allottee_name',
        'issue_date', 'status', 'regulation_file_present',
    )
    list_filter   = ('colony', 'status', 'regulation_file_present')
    search_fields = ('patta_number', 'allottee_name', 'challan_number')
    ordering      = ('colony__name', 'patta_number')
    readonly_fields = ('created_at', 'updated_at', 'updated_by')
    fieldsets = (
        ('Patta Identity', {
            'fields': ('patta_number', 'colony', 'status', 'superseded_by'),
        }),
        ('Allottee', {
            'fields': ('allottee_name', 'allottee_address'),
        }),
        ('Dates & Challan', {
            'fields': ('issue_date', 'amendment_date', 'challan_number', 'challan_date'),
        }),
        ('Lease & File', {
            'fields': ('lease_amount', 'lease_duration', 'regulation_file_present', 'document'),
        }),
        ('Remarks', {
            'fields': ('remarks',),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'updated_by'),
        }),
    )


@admin.register(PlotPattaMapping)
class PlotPattaMappingAdmin(admin.ModelAdmin):
    list_display  = ('patta', 'plot', 'ownership_share_pct', 'allottee_role', 'document_status')
    list_filter   = ('allottee_role', 'document_status')
    search_fields = ('patta__patta_number', 'plot__plot_number')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PattaVersion)
class PattaVersionAdmin(admin.ModelAdmin):
    list_display    = ('patta', 'changed_by', 'changed_at')
    list_filter     = ('changed_by',)
    search_fields   = ('patta__patta_number',)
    ordering        = ('-changed_at',)
    readonly_fields = ('patta', 'changed_by', 'changed_at', 'snapshot')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
