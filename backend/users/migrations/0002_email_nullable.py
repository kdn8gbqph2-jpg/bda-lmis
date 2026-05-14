"""
Make CustomUser.email optional.

Many internal staff accounts only have an SSO ID, not an email. Email
remains unique among users that DO have one (Postgres treats NULLs as
distinct, so the unique constraint still holds correctly).

Login by email still works for users with one; login by username /
emp_id (handled by CustomTokenObtainPairSerializer) covers everyone
else.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='email',
            field=models.EmailField(
                max_length=254, unique=True, blank=True, null=True,
            ),
        ),
    ]
