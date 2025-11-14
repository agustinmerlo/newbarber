# caja/utils.py
from rest_framework.exceptions import ValidationError
from .models import TurnoCaja


def validar_caja_abierta():
    """
    Valida que exista un turno de caja abierto
    Lanza ValidationError si no hay caja abierta
    """
    turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
    
    if not turno_activo:
        raise ValidationError({
            'error': 'La caja está cerrada',
            'mensaje': 'Debes abrir la caja antes de registrar pagos o confirmar reservas.',
            'accion_requerida': 'Ir a Caja → Abrir Turno',
            'caja_abierta': False
        })
    
    return turno_activo


def obtener_turno_activo():
    """
    Retorna el turno activo o None
    """
    return TurnoCaja.objects.filter(estado='abierto').first()


def registrar_pago_en_caja(reserva, monto, metodo_pago, tipo_pago='seña', usuario=None):
    """
    Registra un pago de reserva en la caja
    
    Args:
        reserva: Instancia de Reserva
        monto: Decimal con el monto del pago
        metodo_pago: str (efectivo, tarjeta, transferencia, mercadopago)
        tipo_pago: str ('seña' o 'saldo')
        usuario: User que registra el pago
    
    Returns:
        MovimientoCaja creado
    """
    from .models import MovimientoCaja
    from decimal import Decimal
    
    # Validar que haya caja abierta
    turno_activo = validar_caja_abierta()
    
    # Validar monto
    if isinstance(monto, (int, float)):
        monto = Decimal(str(monto))
    
    if monto <= 0:
        raise ValidationError({
            'error': 'Monto inválido',
            'mensaje': 'El monto debe ser mayor a 0'
        })
    
    # Preparar descripción
    servicios_nombres = ', '.join([
        s.get('nombre', '') for s in (reserva.servicios or [])[:3]
    ]) if reserva.servicios else 'Servicios varios'
    
    tipo_pago_texto = 'Seña' if tipo_pago == 'seña' else 'Saldo'
    
    descripcion = (
        f'{tipo_pago_texto} reserva #{reserva.id} - '
        f'{reserva.nombre_cliente} {reserva.apellido_cliente} - '
        f'{servicios_nombres}'
    )
    
    # Crear movimiento
    movimiento = MovimientoCaja.objects.create(
        tipo='ingreso',
        monto=monto,
        descripcion=descripcion,
        metodo_pago=metodo_pago,
        categoria='servicios',
        barbero=reserva.barbero,
        reserva=reserva,
        turno=turno_activo,
        usuario_registro=usuario,
        comprobante=reserva.comprobante if tipo_pago == 'seña' else None
    )
    
    return movimiento 