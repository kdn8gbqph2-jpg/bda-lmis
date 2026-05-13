from django.apps import AppConfig


class DmsSyncConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name  = 'dms_sync'
    label = 'bda_dms_sync'   # keep prefix-style label, matches gis/transliterate
