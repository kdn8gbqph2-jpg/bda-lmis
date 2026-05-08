import json
from rest_framework import serializers
from .models import CustomLayer, LayerFeature


class LayerFeatureSerializer(serializers.ModelSerializer):
    geometry = serializers.SerializerMethodField()

    def get_geometry(self, obj):
        if obj.geometry:
            return json.loads(obj.geometry.geojson)
        return None

    class Meta:
        model  = LayerFeature
        fields = ('id', 'feature_id', 'geometry', 'properties')


class CustomLayerListSerializer(serializers.ModelSerializer):
    layer_type_display = serializers.CharField(source='get_layer_type_display', read_only=True)
    colony_name        = serializers.CharField(source='colony.name', read_only=True,
                                               allow_null=True)
    feature_count      = serializers.SerializerMethodField()

    def get_feature_count(self, obj):
        return obj.features.count()

    class Meta:
        model  = CustomLayer
        fields = (
            'id', 'name', 'layer_type', 'layer_type_display',
            'colony', 'colony_name', 'style', 'is_public',
            'source_file', 'feature_count', 'created_at',
        )


class CustomLayerDetailSerializer(serializers.ModelSerializer):
    layer_type_display = serializers.CharField(source='get_layer_type_display', read_only=True)
    colony_name        = serializers.CharField(source='colony.name', read_only=True,
                                               allow_null=True)

    class Meta:
        model  = CustomLayer
        fields = (
            'id', 'name', 'layer_type', 'layer_type_display',
            'colony', 'colony_name',
            'style', 'is_public', 'source_file', 'metadata',
            'created_by', 'created_at', 'updated_at',
        )
        read_only_fields = ('created_by', 'created_at', 'updated_at')


class CustomLayerWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CustomLayer
        fields = ('name', 'layer_type', 'colony', 'style', 'is_public', 'metadata')


class CustomLayerGeoJSONSerializer:
    """Static helper to produce GeoJSON FeatureCollection from a layer."""

    @classmethod
    def collection(cls, layer: CustomLayer) -> dict:
        features = []
        for feat in layer.features.all():
            geom = json.loads(feat.geometry.geojson) if feat.geometry else None
            features.append({
                'type': 'Feature',
                'geometry': geom,
                'properties': {
                    'feature_id': feat.feature_id,
                    'layer_id':   layer.id,
                    'layer_name': layer.name,
                    'layer_type': layer.layer_type,
                    **feat.properties,
                },
            })
        return {
            'type': 'FeatureCollection',
            'features': features,
        }
