from django.db.models import Q
from django_filters import FilterSet, CharFilter, NumberFilter, ChoiceFilter, BooleanFilter
from .models import Patta, PATTA_STATUS_CHOICES


class PattaFilter(FilterSet):
    colony                  = NumberFilter(field_name='colony_id')
    status                  = ChoiceFilter(choices=PATTA_STATUS_CHOICES)
    regulation_file_present = BooleanFilter()
    search                  = CharFilter(method='filter_search',
                                         label='Search patta number or allottee name')

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(patta_number__icontains=value) |
            Q(allottee_name__icontains=value)
        )

    class Meta:
        model  = Patta
        fields = ['colony', 'status', 'regulation_file_present', 'search']
