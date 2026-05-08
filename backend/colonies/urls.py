from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ColonyViewSet, KhasraViewSet

router = DefaultRouter()
router.register(r'', ColonyViewSet, basename='colony')

khasra_router = DefaultRouter()
khasra_router.register(r'', KhasraViewSet, basename='khasra')

# Colony URLs:  /api/colonies/...
colony_urlpatterns = [
    path('', include(router.urls)),
]

# Khasra URLs:  /api/khasras/...
khasra_urlpatterns = [
    path('', include(khasra_router.urls)),
]
