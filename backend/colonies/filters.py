import django_filters
from .models import Colony, Khasra


class ColonyFilter(django_filters.FilterSet):
    zone            = django_filters.CharFilter(lookup_expr='iexact')
    status          = django_filters.CharFilter(lookup_expr='iexact')
    colony_type     = django_filters.CharFilter(lookup_expr='iexact')
    revenue_village = django_filters.CharFilter(lookup_expr='icontains')
    khasra          = django_filters.CharFilter(method='filter_khasra', label='Khasra number')
    search          = django_filters.CharFilter(method='filter_search', label='Search')
    has_map         = django_filters.BooleanFilter(method='filter_has_map', label='Has map')

    def filter_search(self, queryset, name, value):
        return queryset.filter(name__icontains=value)

    def filter_khasra(self, queryset, name, value):
        """Match colonies that own a khasra whose number contains the given text.
        Distinct() avoids row multiplication from the JOIN."""
        return queryset.filter(khasras__number__icontains=value).distinct()

    def filter_has_map(self, queryset, name, value):
        """Filter colonies that have at least one uploaded map file."""
        empty_kwargs   = {f'map_{f}': '' for f in ('pdf', 'jpeg', 'png', 'svg')}
        nullish_kwargs = {f'map_{f}__isnull': True for f in ('pdf', 'jpeg', 'png', 'svg')}
        if value:
            return queryset.exclude(**empty_kwargs).exclude(**nullish_kwargs)
        return queryset.filter(**empty_kwargs)

    class Meta:
        model  = Colony
        fields = ['zone', 'status', 'colony_type', 'revenue_village']


class KhasraFilter(django_filters.FilterSet):
    colony = django_filters.NumberFilter(field_name='colony_id')

    class Meta:
        model  = Khasra
        fields = ['colony']
