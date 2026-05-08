from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import CustomUser, ColonyAssignment
from .serializers import (
    UserListSerializer,
    UserDetailSerializer,
    MeSerializer,
    CustomTokenObtainPairSerializer,
)
from .permissions import IsAdmin


class CustomTokenObtainPairView(TokenObtainPairView):
    """POST /api/auth/login/ — returns access + refresh tokens plus user info."""
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(generics.GenericAPIView):
    """POST /api/auth/logout/ — blacklists the refresh token."""
    permission_classes = (IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if not refresh_token:
                return Response(
                    {'detail': 'refresh_token is required.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {'detail': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class MeView(generics.RetrieveAPIView):
    """GET /api/auth/me/ — returns current authenticated user's profile."""
    permission_classes = (IsAuthenticated,)
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    """
    /api/users/           — list, create   (admin only)
    /api/users/{id}/      — retrieve, update, delete (admin only)
    /api/users/{id}/assign-colonies/  — POST (admin only)
    """
    queryset = CustomUser.objects.all().order_by('emp_id')
    permission_classes = (IsAuthenticated, IsAdmin)

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        return UserDetailSerializer

    @action(detail=True, methods=['post'], url_path='assign-colonies')
    def assign_colonies(self, request, pk=None):
        """
        POST /api/users/{id}/assign-colonies/
        Body: { "colony_ids": [1, 3, 5] }
        Replaces the user's current colony assignments.
        """
        user = self.get_object()
        colony_ids = request.data.get('colony_ids', [])

        if not isinstance(colony_ids, list):
            return Response(
                {'detail': 'colony_ids must be a list.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Replace all assignments atomically
        ColonyAssignment.objects.filter(user=user).delete()
        assignments = [
            ColonyAssignment(user=user, colony_id=cid) for cid in colony_ids
        ]
        ColonyAssignment.objects.bulk_create(assignments, ignore_conflicts=True)

        return Response(
            {'detail': f'{len(assignments)} colony assignment(s) saved.'},
            status=status.HTTP_200_OK,
        )
