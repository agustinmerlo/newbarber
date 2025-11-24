# usuarios/signals.py
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserProfile


@receiver(pre_save, sender=UserProfile)
def sync_barber_on_role_change(sender, instance, **kwargs):
    """
    🔄 SINCRONIZACIÓN AUTOMÁTICA: UserProfile → Barber
    
    Detecta cambios en el rol del perfil y sincroniza con la app barbers:
    - barbero → otro rol: Soft delete del barbero
    - otro rol → barbero: Restaura el barbero si existe
    - Desactivación: Soft delete del barbero
    """
    if not instance.pk:
        return  # Es un nuevo perfil, no hacer nada
    
    try:
        # Obtener el estado anterior
        old_profile = UserProfile.objects.get(pk=instance.pk)
        old_role = old_profile.role
        new_role = instance.role
        
        # CASO 1: Cambio de rol barbero → otro rol (degradación)
        if old_role == 'barbero' and new_role != 'barbero':
            _deactivate_barber(instance.user)
            print(f"✅ Barbero degradado: {instance.user.username}")
        
        # CASO 2: Cambio de otro rol → barbero (promoción)
        elif old_role != 'barbero' and new_role == 'barbero':
            _restore_or_create_barber(instance.user)
            print(f"✅ Usuario promocionado a barbero: {instance.user.username}")
        
        # CASO 3: Desactivación de un barbero
        if old_profile.activo and not instance.activo and instance.role == 'barbero':
            _deactivate_barber(instance.user)
            print(f"✅ Barbero desactivado: {instance.user.username}")
        
        # CASO 4: Reactivación de un barbero
        elif not old_profile.activo and instance.activo and instance.role == 'barbero':
            _restore_or_create_barber(instance.user)
            print(f"✅ Barbero reactivado: {instance.user.username}")
            
    except UserProfile.DoesNotExist:
        pass


@receiver(post_save, sender=User)
def sync_barber_on_user_status_change(sender, instance, created, **kwargs):
    """
    🔄 SINCRONIZACIÓN: User.is_active → Barber
    
    Si se desactiva un usuario que es barbero, desactiva su perfil de barbero
    """
    if created:
        return  # Usuario nuevo, no hacer nada
    
    # Si el usuario tiene rol barbero y se desactiva
    if hasattr(instance, 'profile') and instance.profile.role == 'barbero':
        if not instance.is_active:
            _deactivate_barber(instance)
            print(f"✅ Barbero desactivado por usuario inactivo: {instance.username}")


# ============================================================================
# 🛠️ FUNCIONES AUXILIARES
# ============================================================================

def _deactivate_barber(user):
    """
    Desactiva (soft delete) el perfil de barbero asociado al usuario
    """
    try:
        from barbers.models import Barber
        
        # Buscar barbero activo o eliminado
        barber = Barber.all_objects.filter(user=user).first()
        
        if barber and not barber.is_deleted:
            barber.soft_delete()
            print(f"  → Barbero soft-deleted en barbers app")
    except Exception as e:
        print(f"  ⚠️ Error al desactivar barbero: {e}")


def _restore_or_create_barber(user):
    """
    Restaura el perfil de barbero si existe (estaba eliminado)
    Si no existe, crea uno nuevo automáticamente
    """
    try:
        from barbers.models import Barber
        
        # Buscar si existe un barbero (incluso eliminado)
        barber = Barber.all_objects.filter(user=user).first()
        
        if barber:
            if barber.is_deleted:
                barber.restore()
                print(f"  → Barbero restaurado en barbers app")
        else:
            # No existe, crear nuevo perfil de barbero
            full_name = f"{user.first_name} {user.last_name}".strip() or user.username
            Barber.objects.create(
                user=user,
                name=full_name,
                specialty="",
                work_schedule=""
            )
            print(f"  → Nuevo perfil de barbero creado automáticamente")
    except Exception as e:
        print(f"  ⚠️ Error al restaurar/crear barbero: {e}") 