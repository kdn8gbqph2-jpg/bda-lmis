from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ColonyViewSet, KhasraViewSet
from .views_public import (
    PublicColonyListView,
    PublicColonyDetailView,
    PublicColonyMapDownloadView,
    PublicColonyGeoJSONView,
    ColonyTypeListView,
    PublicRevenueVillageListView,
)

router = DefaultRouter()
router.register(r'', ColonyViewSet, basename='colony')

khasra_router = DefaultRouter()
khasra_router.register(r'', KhasraViewSet, basename='khasra')

# Colony URLs:  /api/colonies/...
colony_urlpatterns = [
    path('', include(router.urls)),
]

# Required by include('colonies.urls') in config/urls.py
urlpatterns = colony_urlpatterns

# Khasra URLs:  /api/khasras/...
khasra_urlpatterns = [
    path('', include(khasra_router.urls)),
]

# Public URLs:  /api/public/...  (mounted in config/urls.py)
public_urlpatterns = [
    path('colony-types/',                            ColonyTypeListView.as_view(),           name='public-colony-types'),
    path('revenue-villages/',                        PublicRevenueVillageListView.as_view(), name='public-revenue-villages'),
    path('colonies/',                                PublicColonyListView.as_view(),          name='public-colony-list'),
    path('colonies/geojson/',                        PublicColonyGeoJSONView.as_view(),       name='public-colony-geojson'),
    path('colonies/<int:pk>/',                       PublicColonyDetailView.as_view(),        name='public-colony-detail'),
    path('colonies/<int:pk>/map/<str:fmt>/',         PublicColonyMapDownloadView.as_view(),   name='public-colony-map'),
]
