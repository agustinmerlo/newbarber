# usuarios/apps.py
from django.apps import AppConfig


class UsuariosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'usuarios'
    verbose_name = 'Gestión de Usuarios'

    def ready(self):
        """
        Importa las signals cuando la app está lista
        """
        import usuarios.signals  # ← IMPORTANTE: Registra las signals