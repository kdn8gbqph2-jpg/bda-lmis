from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display    = ('timestamp', 'user', 'action', 'entity_type', 'entity_id', 'ip_address')
    list_filter     = ('action', 'entity_type')
    search_fields   = ('entity_type', 'user__email', 'user__username', 'ip_address')
    ordering        = ('-timestamp',)
    readonly_fields = ('timestamp', 'user', 'entity_type', 'entity_id', 'action',
                       'old_values', 'new_values', 'ip_address', 'user_agent')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
