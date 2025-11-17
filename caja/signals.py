# caja/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from reservas.models import Reserva
from .models import MovimientoCaja, TurnoCaja


@receiver(post_save, sender=Reserva)
def registrar_sena_en_caja(sender, instance, created, **kwargs):
    """
    Registra automáticamente la seña de una reserva en la caja
    cuando se confirma una reserva con seña > 0
    """
    # Solo procesar si la reserva está confirmada y tiene seña
    if instance.estado == 'confirmada' and instance.seña and instance.seña > 0:
        
        # Verificar si ya existe un movimiento de caja para esta seña
        movimiento_existente = MovimientoCaja.objects.filter(
            reserva=instance,
            categoria='sena_reserva',
            tipo='ingreso'
        ).first()
        
        # Si no existe, crear el movimiento
        if not movimiento_existente:
            # Obtener el turno activo
            turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
            
            # Crear el movimiento de caja
            MovimientoCaja.objects.create(
                turno=turno_activo,
                tipo='ingreso',
                monto=instance.seña,
                descripcion=f"Seña de reserva #{instance.id} - {instance.nombre_cliente} {instance.apellido_cliente}",
                metodo_pago='mercadopago',  # Asumiendo que las señas son por MercadoPago
                categoria='sena_reserva',
                reserva=instance,
                barbero=instance.barbero,
                fecha=instance.fecha
            )


@receiver(post_save, sender=Reserva)
def registrar_saldo_pagado_en_caja(sender, instance, **kwargs):
    """
    Registra el saldo pagado en el local cuando se completa el pago
    """
    # Solo procesar si hay saldo pagado y método de pago
    if instance.saldo_pagado and instance.saldo_pagado > 0 and instance.metodo_pago:
        
        # Verificar si ya existe un movimiento para este saldo
        movimiento_existente = MovimientoCaja.objects.filter(
            reserva=instance,
            categoria='servicios',
            tipo='ingreso',
            monto=instance.saldo_pagado
        ).exists()
        
        # Si no existe, crear el movimiento
        if not movimiento_existente:
            # Obtener el turno activo
            turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
            
            # Si no hay turno activo, no registrar (evitar errores)
            if not turno_activo:
                return
            
            # Crear el movimiento de caja
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