from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CustomLayerViewSet,
    ColonyGeoJSONView,
    KhasraGeoJSONView,
    PlotGeoJSONView,
)

router = DefaultRouter()
router.register(r'custom-layers', CustomLayerViewSet, basename='custom-layer')

urlpatterns = [
    path('', include(router.urls)),

    # Consolidated GeoJSON endpoints for map rendering
    path('colonies/geojson/', ColonyGeoJSONView.as_view(),  name='gis-colonies-geojson'),
    path('khasras/geojson/',  KhasraGeoJSONView.as_view(),  name='gis-khasras-geojson'),
    path('plots/geojson/',    PlotGeoJSONView.as_view(),    name='gis-plots-geojson'),
]
