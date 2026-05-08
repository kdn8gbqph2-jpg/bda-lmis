from django_filters import FilterSet, CharFilter, NumberFilter, ChoiceFilter
from .models import Plot, PLOT_STATUS_CHOICES, PLOT_TYPE_CHOICES


class PlotFilter(FilterSet):
    colony   = NumberFilter(field_name='colony_id')
    khasra   = NumberFilter(field_name='primary_khasra_id')
    status   = ChoiceFilter(choices=PLOT_STATUS_CHOICES)
    type     = ChoiceFilter(choices=PLOT_TYPE_CHOICES)
    search   = CharFilter(method='filter_search', label='Search plot number')

    def filter_search(self, queryset, name, value):
        return queryset.filter(plot_number__icontains=value)

    class Meta:
        model  = Plot
        fields = ['colony', 'khasra', 'status', 'type', 'search']
