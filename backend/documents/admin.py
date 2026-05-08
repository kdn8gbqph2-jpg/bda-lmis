from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display    = (
        'id', 'original_filename', 'dms_file_number',
        'document_type', 'status', 'uploaded_by', 'uploaded_at',
    )
    list_filter     = ('document_type', 'status', 'file_type')
    search_fields   = ('original_filename', 'dms_file_number',
                       'linked_patta__patta_number', 'uploaded_by__email')
    ordering        = ('-uploaded_at',)
    readonly_fields = (
        'original_filename', 'file_size_bytes', 'file_type', 'mime_type',
        'uploaded_by', 'uploaded_at', 'verified_by', 'verified_at',
        'created_at', 'updated_at',
    )
    fieldsets = (
        ('File', {
            'fields': (
                'file', 'original_filename', 'file_type', 'mime_type',
                'file_size_bytes', 'dms_file_number',
            ),
        }),
        ('Classification', {
            'fields': ('document_type', 'status'),
        }),
        ('Links', {
            'fields': ('linked_plot', 'linked_patta'),
        }),
        ('Audit', {
            'fields': (
                'uploaded_by', 'uploaded_at',
                'verified_by', 'verified_at',
                'created_at', 'updated_at',
            ),
        }),
    )

    def has_delete_permission(self, request, obj=None):
        """Enforce 7-year retention: no hard deletes from admin either."""
        return False
