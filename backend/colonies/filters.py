import django_filters
from .models import Colony, Khasra


class ColonyFilter(django_filters.FilterSet):
    zone        = django_filters.CharFilter(lookup_expr='iexact')
    status      = django_filters.CharFilter(lookup_expr='iexact')
    colony_type = django_filters.CharFilter(lookup_expr='iexact')
    search      = django_filters.CharFilter(method='filter_search', label='Search')
    has_map     = django_filters.BooleanFilter(method='filter_has_map', label='Has map')

    def filter_search(self, queryset, name, value):
        return queryset.filter(name__icontains=value)

    def filter_has_map(self, queryset, name, value):
        """Filter colonies that have at least one uploaded map file."""
        if value:
            return queryset.exclude(map_pdf='', map_svg='', map_png='').exclude(
                map_pdf__isnull=True, map_svg__isnull=True, map_png__isnull=True,
            )
        return queryset.filter(map_pdf='', map_svg='', map_png='')

    class Meta:
        model  = Colony
        fields = ['zone', 'status', 'colony_type']


class KhasraFilter(django_filters.FilterSet):
    colony = django_filters.NumberFilter(field_name='colony_id')

    class Meta:
        model  = Khasra
        fields = ['colony']
