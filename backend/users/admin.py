from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, ColonyAssignment


class ColonyAssignmentInline(admin.TabularInline):
    model = ColonyAssignment
    extra = 1


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    inlines = (ColonyAssignmentInline,)
    list_display  = ('emp_id', 'email', 'get_full_name', 'role', 'department', 'is_active')
    list_filter   = ('role', 'is_active', 'department')
    search_fields = ('emp_id', 'email', 'first_name', 'last_name')
    ordering      = ('emp_id',)

    fieldsets = (
        (None,           {'fields': ('email', 'password')}),
        ('Personal',     {'fields': ('username', 'first_name', 'last_name', 'mobile')}),
        ('BDA Info',     {'fields': ('emp_id', 'role', 'department')}),
        ('Permissions',  {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Activity',     {'fields': ('last_login', 'last_login_ip')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields':  ('email', 'username', 'emp_id', 'role', 'password1', 'password2'),
        }),
    )
    readonly_fields = ('last_login', 'last_login_ip')


@admin.register(ColonyAssignment)
class ColonyAssignmentAdmin(admin.ModelAdmin):
    list_display  = ('user', 'colony')
    list_filter   = ('colony',)
    search_fields = ('user__emp_id', 'user__email')
