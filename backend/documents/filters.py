from django_filters import FilterSet, CharFilter, NumberFilter, ChoiceFilter
from .models import Document, DOCUMENT_TYPE_CHOICES, DOCUMENT_STATUS_CHOICES


class DocumentFilter(FilterSet):
    linked_plot  = NumberFilter(field_name='linked_plot_id')
    linked_patta = NumberFilter(field_name='linked_patta_id')
    type         = ChoiceFilter(field_name='document_type', choices=DOCUMENT_TYPE_CHOICES)
    status       = ChoiceFilter(choices=DOCUMENT_STATUS_CHOICES)
    dms          = CharFilter(field_name='dms_file_number', lookup_expr='icontains')

    class Meta:
        model  = Document
        fields = ['linked_plot', 'linked_patta', 'type', 'status', 'dms']
