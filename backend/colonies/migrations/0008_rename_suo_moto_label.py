"""
Display-label change only: 'SUO-Moto' → 'Regularized Colonies'.
The stored value stays 'suo_moto' so existing rows, audit logs, and
the /api/public URL query param keep working without a backfill.

Django generates an AlterField on `choices=` changes — this migration
just records that for makemigrations consistency; no DDL is emitted.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colonies', '0007_add_revenue_village'),
    ]

    operations = [
        migrations.AlterField(
            model_name='colony',
            name='colony_type',
            field=models.CharField(
                choices=[
                    ('bda_scheme',       'BDA Scheme'),
                    ('private_approved', 'BDA Approved'),
                    ('suo_moto',         'Regularized Colonies'),
                    ('pending_layout',   'Pending Layout Approval'),
                    ('rejected_layout',  'Rejected Layout'),
                ],
                db_index=True,
                default='bda_scheme',
                help_text='Category shown on the public dashboard.',
                max_length=30,
            ),
        ),
    ]
