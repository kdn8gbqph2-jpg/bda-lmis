from django.apps import AppConfig


class TransliterateConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name  = 'transliterate'
    label = 'bda_transliterate'   # avoid future clashes
