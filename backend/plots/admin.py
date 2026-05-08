from django.contrib.gis.admin import GISModelAdmin
from django.contrib import admin
from .models import Plot, PlotKhasraMapping


class PlotKhasraMappingInline(admin.TabularInline):
    model  = PlotKhasraMapping
    extra  = 0
    fields = ('khasra', 'intersection_area_sqm', 'notes')


@admin.register(Plot)
class PlotAdmin(GISModelAdmin):
    inlines       = (PlotKhasraMappingInline,)
    list_display  = (
        'plot_number', 'colony', 'primary_khasra',
        'type', 'area_sqy', 'area_sqm', 'status',
    )
    list_filter   = ('colony', 'type', 'status')
    search_fields = ('plot_number', 'colony__name')
    ordering      = ('colony__name', 'plot_number')
    readonly_fields = ('area_sqm', 'created_at', 'updated_at', 'updated_by')
    fieldsets = (
        ('Basic Info', {
            'fields': ('plot_number', 'colony', 'primary_khasra', 'type', 'status'),
        }),
        ('Area', {
            'fields': ('area_sqy', 'area_sqm'),
            'description': 'area_sqm is computed automatically from area_sqy.',
        }),
        ('Geometry', {
            'fields': ('geometry',),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'updated_by'),
        }),
    )


@admin.register(PlotKhasraMapping)
class PlotKhasraMappingAdmin(admin.ModelAdmin):
    list_display  = ('plot', 'khasra', 'intersection_area_sqm')
    list_filter   = ('khasra__colony',)
    search_fields = ('plot__plot_number', 'khasra__number')
    ordering      = ('plot__plot_number',)
    readonly_fields = ('created_at', 'updated_at')
