# caja/signals.py
"""
Archivo de signals para la app caja.

NOTA IMPORTANTE: 
Los signals que registraban automáticamente los pagos de reservas
han sido DESACTIVADOS para evitar duplicación de registros en caja.

El registro de pagos se maneja manualmente en:
- reservas/views.py -> confirmar_reserva() 
- reservas/views.py -> pagar_saldo()
- reservas/views.py -> actualizar_reserva()

Usando la función: caja.utils.registrar_pago_en_caja()
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

# ❌ SIGNALS DESACTIVADOS PARA EVITAR DUPLICACIÓN
# Si necesitas reactivarlos en el futuro, asegúrate de:
# 1. Agregar verificación de duplicados
# 2. Usar banderas (_skip_signal) 
# 3. O eliminar el registro manual de los views

"""
# CÓDIGO ANTERIOR (CAUSA DUPLICACIÓN - NO USAR)

from reservas.models import Reserva
from .models import MovimientoCaja, TurnoCaja


@receiver(post_save, sender=Reserva)
def registrar_sena_en_caja(sender, instance, created, **kwargs):
    # ❌ ESTO CAUSA DUPLICACIÓN
    if instance.estado == 'confirmada' and instance.seña and instance.seña > 0:
        movimiento_existente = MovimientoCaja.objects.filter(
            reserva=instance,
            categoria='sena_reserva',
            tipo='ingreso'
        ).first()
        
        if not movimiento_existente:
            turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
            
            MovimientoCaja.objects.create(
                turno=turno_activo,
                tipo='ingreso',
                monto=instance.seña,
                descripcion=f"Seña de reserva #{instance.id} - {instance.nombre_cliente} {instance.apellido_cliente}",
                metodo_pago='mercadopago',
                categoria='sena_reserva',
                reserva=instance,
                barbero=instance.barbero,
                fecha=instance.fecha
            )


@receiver(post_save, sender=Reserva)
def registrar_saldo_pagado_en_caja(sender, instance, **kwargs):
    # ❌ ESTO TAMBIÉN CAUSA DUPLICACIÓN
    if instance.saldo_pagado and instance.saldo_pagado > 0 and instance.metodo_pago:
        movimiento_existente = MovimientoCaja.objects.filter(
            reserva=instance,
            categoria='servicios',
            tipo='ingreso',
            monto=instance.saldo_pagado
        ).exists()
        
        if not movimiento_existente:
            turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
            
            if not turno_activo:
                return
            
            MovimientoCaja.objects.create(
                turno=turno_activo,
                tipo='ingreso',
                monto=instance.saldo_pagado,
                descripcion=f"Pago de servicio - Reserva #{instance.id} - {instance.nombre_cliente} {instance.apellido_cliente}",
                metodo_pago=instance.metodo_pago,
                categoria='servicios',
                reserva=instance,
                barbero=instance.barbero,
                fecha=instance.fecha if instance.fecha else None
            )
"""

# ✅ Si necesitas agregar nuevos signals que NO causen duplicación, hazlo aquí
# Ejemplo de signal que SÍ está bien usar:

# @receiver(post_save, sender=TurnoCaja)
# def calcular_totales_al_guardar_turno(sender, instance, **kwargs):
#     """Este tipo de signal está bien porque no duplica datos"""
#     if instance.estado == 'abierto':
#         instance.calcular_totales()