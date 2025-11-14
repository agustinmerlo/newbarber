# reservas/apps.py
from django.apps import AppConfig


class ReservasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'reservas'
    verbose_name = 'Reservas'
    
    def ready(self):
        """Importar las señales cuando la app esté lista"""
        import reservas.signals