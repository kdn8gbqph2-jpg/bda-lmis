from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # App routers (wired as apps are implemented)
    path('api/users/', include('users.urls')),
    path('api/colonies/', include('colonies.urls')),
    path('api/plots/', include('plots.urls')),
    path('api/pattas/', include('pattas.urls')),
    path('api/documents/', include('documents.urls')),
    path('api/gis/', include('gis.urls')),
    path('api/dashboard/', include('dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
