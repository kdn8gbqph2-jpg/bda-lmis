from django.urls import path
from .views import DashboardStatsView, ColonyProgressView, ZoneBreakdownView

urlpatterns = [
    path('stats/',            DashboardStatsView.as_view(),  name='dashboard-stats'),
    path('colony-progress/',  ColonyProgressView.as_view(),  name='dashboard-colony-progress'),
    path('zone-breakdown/',   ZoneBreakdownView.as_view(),   name='dashboard-zone-breakdown'),
]
