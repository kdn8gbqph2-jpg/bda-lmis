from django.urls import path

from .views import TransliterateView

urlpatterns = [
    path('', TransliterateView.as_view(), name='transliterate'),
]
