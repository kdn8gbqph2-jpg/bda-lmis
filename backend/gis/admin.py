from django.contrib.gis.admin import GISModelAdmin
from django.contrib import admin
from .models import CustomLayer, LayerFeature


class LayerFeatureInline(admin.TabularInline):
    model   = LayerFeature
    extra   = 0
    fields  = ('feature_id', 'properties')
    readonly_fields = ('created_at', 'updated_at')
    show_change_link = True


@admin.register(CustomLayer)
class CustomLayerAdmin(GISModelAdmin):
    inlines       = (LayerFeatureInline,)
    list_display  = ('name', 'layer_type', 'colony', 'is_public', 'created_by', 'created_at')
    list_filter   = ('layer_type', 'is_public', 'colony')
    search_fields = ('name', 'colony__name')
    ordering      = ('layer_type', 'name')
    readonly_fields = ('created_by', 'created_at', 'updated_at')
    fieldsets = (
        ('Layer Info', {
            'fields': ('name', 'layer_type', 'colony', 'is_public', 'source_file'),
        }),
        ('Geometry', {
            'fields': ('geometry',),
        }),
        ('Style & Metadata', {
            'fields': ('style', 'metadata'),
        }),
        ('Audit', {
            'fields': ('created_by', 'created_at', 'updated_at'),
        }),
    )


@admin.register(LayerFeature)
class LayerFeatureAdmin(GISModelAdmin):
    list_display    = ('feature_id', 'custom_layer', 'created_at')
    list_filter     = ('custom_layer__layer_type',)
    search_fields   = ('feature_id', 'custom_layer__name')
    ordering        = ('custom_layer', 'feature_id')
    readonly_fields = ('created_at', 'updated_at')
