from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import CustomUser, ColonyAssignment


class ColonyAssignmentSerializer(serializers.ModelSerializer):
    colony_name = serializers.CharField(source='colony.name', read_only=True)

    class Meta:
        model = ColonyAssignment
        fields = ('colony', 'colony_name')


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'emp_id', 'username', 'email',
            'full_name', 'role', 'department', 'is_active',
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
    Extends the default JWT token response to include basic user info,
    so the frontend does not need a separate /me call right after login.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = MeSerializer(self.user).data
        return data
