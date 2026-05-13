from django.urls import path

from .views import DmsFilePdfView

urlpatterns = [
    # The dms_number itself can contain letters and digits (BHR104945)
    # so a permissive slug-style match is enough.
    path('file/<str:dms_number>/', DmsFilePdfView.as_view(), name='dms-file-pdf'),
]
