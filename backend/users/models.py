from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from .managers import CustomUserManager


class CustomUser(AbstractBaseUser, PermissionsMixin):

    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('superintendent', 'Superintendent'),
        ('staff', 'Staff'),
        ('public', 'Public'),
    ]

    username        = models.CharField(max_length=150, unique=True)
    # email is optional: many internal users have only an SSO ID. Postgres
    # treats NULLs as distinct so the unique constraint still holds across
    # the users who DO have an email.
    email           = models.EmailField(max_length=254, unique=True, blank=True, null=True)
    first_name      = models.CharField(max_length=150, blank=True)
    last_name       = models.CharField(max_length=150, blank=True)
    emp_id          = models.CharField(max_length=20, unique=True)
    role            = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    department      = models.CharField(max_length=30, blank=True)
    mobile          = models.CharField(max_length=10, blank=True)
    is_active       = models.BooleanField(default=True)
    is_staff        = models.BooleanField(default=False)   # Django admin access
    last_login_ip   = models.GenericIPAddressField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username', 'emp_id']

    objects = CustomUserManager()

    class Meta:
        db_table = 'users_customuser'
        indexes = [
            models.Index(fields=['role']),
            models.Index(fields=['emp_id']),
        ]

    def __str__(self):
        return f'{self.get_full_name()} ({self.emp_id})'

    def get_full_name(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.username


class ColonyAssignment(models.Model):
    user    = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name='colony_assignments'
    )
    colony  = models.ForeignKey(
        'colonies.Colony', on_delete=models.CASCADE, related_name='user_assignments'
    )

    class Meta:
        db_table = 'users_colonyassignment'
        unique_together = ('user', 'colony')

    def __str__(self):
        return f'{self.user.emp_id} → {self.colony}'
