from django.apps import AppConfig


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'

    def ready(self):
        # Wire cache-invalidation handlers so dashboard responses stay in
        # sync with edits made anywhere (API, admin, mgmt commands).
        from . import signals
        signals.connect_signals()
