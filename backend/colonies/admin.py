from django.contrib.gis.admin import GISModelAdmin
from django.contrib import admin
from .models import Colony, Khasra


class KhasraInline(admin.TabularInline):
    model  = Khasra
    extra  = 0
    fields = ('number', 'total_bigha')


@admin.register(Colony)
class ColonyAdmin(GISModelAdmin):
    inlines       = (KhasraInline,)
    list_display  = (
        'name', 'colony_type', 'zone', 'status',
        'total_residential_plots', 'total_commercial_plots',
        'layout_application_date', 'layout_approval_date', 'has_map',
    )
    list_filter   = ('colony_type', 'zone', 'status')
    search_fields = ('name', 'dlc_file_number')
    ordering      = ('name',)
    readonly_fields = ('created_at', 'updated_at', 'updated_by')
    fieldsets = (
        ('Identity', {
            'fields': ('name', 'colony_type', 'zone', 'chak_number', 'status'),
        }),
        ('Survey / Revenue', {
            'fields': ('revenue_village', 'dlc_file_number', 'notified_area_bigha'),
        }),
        ('Timeline', {
            'fields': ('conversion_date', 'layout_application_date', 'layout_approval_date'),
        }),
        ('Rejection / Notes', {
            'fields': ('rejection_reason', 'remarks'),
            'classes': ('collapse',),
        }),
        ('Plot Counts', {
            'fields': ('total_plots_per_layout',
                       'total_residential_plots', 'total_commercial_plots'),
            'description': 'total_plots_per_layout is the Excel layout-plan total '
                           '(source of truth). The residential/commercial pair is '
                           'used only as a fallback when the layout total is unset.',
        }),
        ('Map Files', {
            'fields': ('map_pdf', 'map_jpeg', 'map_png', 'map_svg'),
            'description': 'Upload scanned layout maps in one or more formats.',
        }),
        ('Boundary', {
            'fields': ('boundary', 'boundary_file'),
            'description': 'Source KML/shapefile + parsed MultiPolygon geometry.',
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'updated_by'),
        }),
    )


@admin.register(Khasra)
class KhasraAdmin(GISModelAdmin):
    list_display  = ('number', 'colony', 'total_bigha')
    list_filter   = ('colony',)
    search_fields = ('number', 'colony__name')
    ordering      = ('colony__name', 'number')
    readonly_fields = ('created_at', 'updated_at')
