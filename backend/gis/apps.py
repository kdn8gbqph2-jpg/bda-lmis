from django.apps import AppConfig


class GisConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name  = 'gis'
    label = 'bda_gis'   # avoid clash with django.contrib.gis which also uses label 'gis'
