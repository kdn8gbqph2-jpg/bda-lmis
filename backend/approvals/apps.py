from django.apps import AppConfig


class ApprovalsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name  = 'approvals'
    label = 'bda_approvals'   # consistent with bda_gis / bda_dms_sync / bda_transliterate
