from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import CustomUser, ColonyAssignment


class ColonyAssignmentSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)

    class Meta:
        model = ColonyAssignment
        fields = ('colony', 'colony_name')


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views.

    Carries the raw first_name + last_name + mobile fields so the admin
    Users page can render the name column and pre-fill the Edit modal
    without a second per-row fetch.
    """
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'emp_id', 'username', 'email',
            'first_name', 'last_name', 'full_name',
            'mobile', 'role', 'department', 'is_active',
        )

    def get_full_name(self, obj):
        return obj.get_full_name()


class UserDetailSerializer(serializers.ModelSerializer):
    """Full serializer for create / retrieve / update."""
    full_name        = serializers.SerializerMethodField()
    assigned_colonies = ColonyAssignmentSerializer(
        source='colony_assignments', many=True, read_only=True
    )
    password = serializers.CharField(write_only=True, required=False)
    # Email is optional now — internal staff frequently sign up with
    # only an SSO ID. allow_blank handles the empty-string form value
    # the modal sends; allow_null lets the model store SQL NULL.
    email = serializers.EmailField(
        required=False, allow_blank=True, allow_null=True,
    )

    class Meta:
        model = CustomUser
        fields = (
            'id', 'emp_id', 'username', 'email', 'password',
            'first_name', 'last_name', 'full_name',
            'role', 'department', 'mobile',
            'is_active', 'last_login', 'last_login_ip',
            'created_at', 'updated_at',
            'assigned_colonies',
        )
        read_only_fields = ('last_login', 'last_login_ip', 'created_at', 'updated_at')

    def get_full_name(self, obj):
        return obj.get_full_name()

    def validate_email(self, value):
        """
        The frontend sends an empty string when the operator leaves the
        Email field blank. Convert that to None so the unique constraint
        treats it as missing rather than colliding with other blank
        rows.
        """
        if value in (None, '', '   '):
            return None
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = CustomUser(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class MeSerializer(serializers.ModelSerializer):
    """Returned by GET /api/auth/me/ — current user's own profile."""
    full_name        = serializers.SerializerMethodField()
    assigned_colonies = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'emp_id', 'username', 'email',
            'full_name', 'role', 'department', 'mobile',
            'assigned_colonies',
        )

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_assigned_colonies(self, obj):
        return list(
            obj.colony_assignments.values_list('colony_id', flat=True)
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Lets users sign in with their username, emp_id, or email — whichever
    they remember. The identifier still travels in the `email` field for
    backwards compatibility with the existing frontend client; if it is
    not an email, we resolve it to one before delegating to the parent.

    Also enforces the self-hosted math CAPTCHA: the client must send
    captcha_token + captcha_answer fetched from GET /api/auth/captcha/.
    Each token is single-use (deleted on consume).
    """
    captcha_token  = serializers.CharField(write_only=True, required=True)
    captcha_answer = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        from django.core.cache import cache

        # ── CAPTCHA gate (runs before identity lookup so bot floods don't
        #    even hit the auth backend) ──────────────────────────────────
        token  = attrs.pop('captcha_token',  None)
        answer = attrs.pop('captcha_answer', None)
        cache_key = f'captcha:{token}' if token else None
        expected  = cache.get(cache_key) if cache_key else None
        # Consume the token regardless — single-use semantics.
        if cache_key:
            cache.delete(cache_key)
        if expected is None or str(answer).strip() != str(expected):
            raise serializers.ValidationError(
                {'captcha': ['CAPTCHA verification failed. Please refresh and try again.']}
            )

        identifier = attrs.get(self.username_field, '')
        if identifier and '@' not in identifier:
            # Exact match wins over case-insensitive — handles colliding
            # usernames like 'admin' vs 'Admin'.
            user = (
                CustomUser.objects.filter(username=identifier).first()
                or CustomUser.objects.filter(emp_id=identifier).first()
                or CustomUser.objects.filter(username__iexact=identifier).first()
                or CustomUser.objects.filter(emp_id__iexact=identifier).first()
            )
            if user:
                attrs[self.username_field] = user.email

        data = super().validate(attrs)
        data['user'] = MeSerializer(self.user).data
        return data
