import logging
import secrets

from django.core.cache import cache
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
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

logger = logging.getLogger(__name__)

# ── CAPTCHA ──────────────────────────────────────────────────────────────────

# Cache key prefix and TTL for captcha challenges. The serializer that
# validates login consumes the token (cache.delete) on first read so each
# challenge is single-use.
_CAPTCHA_PREFIX = 'captcha:'
_CAPTCHA_TTL    = 5 * 60   # seconds

import random


def _build_challenge() -> tuple[str, str, int]:
    """
    Generate a simple arithmetic challenge solvable by a human in <2s.
    Returns (token, question_text, integer_answer).
    """
    a = random.randint(2, 9)
    b = random.randint(2, 9)
    op = random.choice(['+', '-', '×'])
    if op == '+':
        answer = a + b
    elif op == '-':
        # keep answer non-negative
        if a < b: a, b = b, a
        answer = a - b
    else:
        answer = a * b
    token = secrets.token_urlsafe(16)
    return token, f'{a} {op} {b}', answer


class CaptchaView(APIView):
    """
    GET /api/auth/captcha/

    Returns a fresh math challenge:
        { "token": "<opaque>", "question": "3 + 7" }

    The expected integer answer is stored in Redis under captcha:<token>
    with a 5-minute TTL. Single-use — consumed on successful login.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        token, question, answer = _build_challenge()
        cache.set(f'{_CAPTCHA_PREFIX}{token}', answer, _CAPTCHA_TTL)
        return Response({'token': token, 'question': question})


# ── Password change ─────────────────────────────────────────────────────────

class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: { current_password, new_password }

    Requires authentication. Writes an AuditLog entry under entity_type=user.
    """
    permission_classes = [IsAuthenticated]

    MIN_LEN = 8

    def post(self, request):
        current = request.data.get('current_password') or ''
        new     = request.data.get('new_password')     or ''

        if not request.user.check_password(current):
            return Response(
                {'current_password': ['Current password is incorrect.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new) < self.MIN_LEN:
            return Response(
                {'new_password': [f'Password must be at least {self.MIN_LEN} characters.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new == current:
            return Response(
                {'new_password': ['New password must differ from the current one.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new)
        request.user.save(update_fields=['password'])

        # Manual audit entry — not covered by the signal handlers
        # (they're wired only on Colony/Plot/Patta/Document).
        try:
            from audit.models import AuditLog
            from audit.middleware import get_current_request_meta
            ip, ua = get_current_request_meta()
            AuditLog.objects.create(
                user=request.user,
                entity_type='user',
                entity_id=request.user.pk,
                action='password_change',
                ip_address=ip,
                user_agent=ua or '',
            )
        except Exception:
            logger.warning('Failed to write audit log for password change', exc_info=True)

        logger.info('User %s changed their password.', request.user.email)
        return Response({'detail': 'Password updated.'}, status=status.HTTP_200_OK)


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
