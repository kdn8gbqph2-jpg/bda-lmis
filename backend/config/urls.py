from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

from users.views import CustomTokenObtainPairView, LogoutView, MeView
from colonies.urls import khasra_urlpatterns, public_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/login/',   CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(),          name='token_refresh'),
    path('api/auth/logout/',  LogoutView.as_view(),                name='token_logout'),
    path('api/auth/me/',      MeView.as_view(),                    name='auth_me'),

    # App routers
    path('api/users/',      include('users.urls')),
    path('api/colonies/',   include('colonies.urls')),
    path('api/khasras/',    include(khasra_urlpatterns)),
    path('api/plots/',      include('plots.urls')),
    path('api/pattas/',     include('pattas.urls')),
    path('api/documents/',  include('documents.urls')),
    path('api/gis/',        include('gis.urls')),
    path('api/dashboard/',   include('dashboard.urls')),
    path('api/audit-logs/',  include('audit.urls')),

    # Public (unauthenticated) colony dashboard
    path('api/public/', include(public_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
