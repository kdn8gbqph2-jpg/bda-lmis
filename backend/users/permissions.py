from rest_framework.permissions import BasePermission
from .models import ColonyAssignment


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrSuperintendent(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ('admin', 'superintendent')
        )


class IsStaffOrAbove(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in ('admin', 'superintendent', 'staff')
        )


class IsAssignedColony(BasePermission):
    """
    Admin and Superintendent can access any colony.
    Staff can only access colonies they are assigned to.
    Checked at object level — colony_id must exist on the obj.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        if request.user.role in ('admin', 'superintendent'):
            return True
        colony_id = getattr(obj, 'colony_id', None)
        if colony_id is None:
            return False
        return ColonyAssignment.objects.filter(
            user=request.user, colony_id=colony_id
        ).exists()
