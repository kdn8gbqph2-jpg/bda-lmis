"""
Zero-pad pure-digit patta_number values to 4 characters.

One-off backfill that mirrors what Patta.save() now does on every write.
Pure-digit rows ("23") become "0023"; alphanumeric rows ("A-100") are
left as-is. The reverse direction is a no-op — we can't recover the
original un-padded form unambiguously, but the padded form is also a
valid CharField value, so nothing breaks.
"""
from django.db import migrations


def pad_existing(apps, schema_editor):
    Patta = apps.get_model('pattas', 'Patta')
    updates = []
    for p in Patta.objects.all().only('id', 'patta_number'):
        raw = (p.patta_number or '').strip()
        if raw.isdigit() and len(raw) < 4:
            p.patta_number = raw.zfill(4)
            updates.append(p)
    if updates:
        Patta.objects.bulk_update(updates, ['patta_number'])


class Migration(migrations.Migration):

    dependencies = [
        ('pattas', '0003_initial'),
    ]

    operations = [
        migrations.RunPython(pad_existing, migrations.RunPython.noop),
    ]
