import django_filters
from .models import Colony, Khasra


class ColonyFilter(django_filters.FilterSet):
    zone   = django_filters.CharFilter(lookup_expr='iexact')
    status = django_filters.CharFilter(lookup_expr='iexact')
    search = django_filters.CharFilter(method='filter_search', label='Search')

    def filter_search(self, queryset, name, value):
        return queryset.filter(name__icontains=value)

    class Meta:
        model  = Colony
        fields = ['zone', 'status']


class KhasraFilter(django_filters.FilterSet):
    colony = django_filters.NumberFilter(field_name='colony_id')

    class Meta:
        model  = Khasra
        fields = ['colony']
