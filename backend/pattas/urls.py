from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PattaViewSet

router = DefaultRouter()
router.register(r'', PattaViewSet, basename='patta')

urlpatterns = [
    path('', include(router.urls)),
]
