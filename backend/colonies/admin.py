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
    list_display  = ('name', 'zone', 'chak_number', 'status', 'total_residential_plots', 'total_commercial_plots', 'layout_approval_date')
    list_filter   = ('zone', 'status')
    search_fields = ('name', 'dlc_file_number')
    ordering      = ('name',)
    readonly_fields = ('created_at', 'updated_at', 'updated_by')
    fieldsets = (
        ('Basic Info',   {'fields': ('name', 'zone', 'chak_number', 'status')}),
        ('Layout',       {'fields': ('conversion_date', 'layout_approval_date', 'dlc_file_number', 'notified_area_bigha')}),
        ('Plot Counts',  {'fields': ('total_residential_plots', 'total_commercial_plots')}),
        ('Boundary',     {'fields': ('boundary',)}),
        ('Audit',        {'fields': ('created_at', 'updated_at', 'updated_by')}),
    )


@admin.register(Khasra)
class KhasraAdmin(GISModelAdmin):
    list_display  = ('number', 'colony', 'total_bigha')
    list_filter   = ('colony',)
    search_fields = ('number', 'colony__name')
    ordering      = ('colony__name', 'number')
    readonly_fields = ('created_at', 'updated_at')
