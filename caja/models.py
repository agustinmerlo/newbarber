# caja/models.py
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal

User = get_user_model()


class TurnoCaja(models.Model):
    """
    Modelo para gestionar turnos de caja con TODOS los métodos de pago
    """
    ESTADO_CHOICES = [
        ('abierto', 'Abierto'),
        ('cerrado', 'Cerrado'),
    ]
    
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='abierto')
    
    # Apertura
    fecha_apertura = models.DateTimeField(default=timezone.now)
    monto_apertura = models.DecimalField(decimal_places=2, max_digits=10)
    usuario_apertura = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='turnos_abiertos'
    )
    
    # Cierre
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    usuario_cierre = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='turnos_cerrados'
    )
    observaciones_cierre = models.TextField(blank=True, null=True)
    
    # ✅ TOTALES ESPERADOS POR MÉTODO DE PAGO
    efectivo_esperado = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    transferencia_esperada = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    mercadopago_esperado = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    seña_esperada = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    
    # ✅ MONTOS REALES AL CERRAR (lo que contaste)
    monto_cierre_efectivo = models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True)
    monto_cierre_transferencia = models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True)
    monto_cierre_mercadopago = models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True)
    monto_cierre_seña = models.DecimalField(decimal_places=2, max_digits=10, null=True, blank=True)
    
    # ✅ DIFERENCIAS POR MÉTODO
    diferencia_efectivo = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    diferencia_transferencia = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    diferencia_mercadopago = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    diferencia_seña = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    diferencia_total = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    
    # ✅ TOTALES GENERALES (para compatibilidad)
    total_ingresos_efectivo = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    total_egresos_efectivo = models.DecimalField(decimal_places=2, default=0, max_digits=10)
    
    # Metadata
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-fecha_apertura']
        verbose_name = 'Turno de Caja'
        verbose_name_plural = 'Turnos de Caja'
    
    def __str__(self):
        fecha = self.fecha_apertura.strftime('%d/%m/%Y %H:%M')
        return f"Turno {self.id} - {fecha} ({self.estado})"
    
    def calcular_totales(self):
        """Calcula los totales del turno por TODOS los métodos de pago"""
        from django.db.models import Sum, Q
        
        movimientos = self.movimientos_turno.all()
        
        # ✅ EFECTIVO
        efectivo_mov = movimientos.filter(metodo_pago='efectivo').aggregate(
            ingresos=Sum('monto', filter=Q(tipo='ingreso')),
            egresos=Sum('monto', filter=Q(tipo='egreso'))
        )
        self.total_ingresos_efectivo = efectivo_mov['ingresos'] or Decimal('0.00')
        self.total_egresos_efectivo = efectivo_mov['egresos'] or Decimal('0.00')
        self.efectivo_esperado = (
            self.monto_apertura + 
            self.total_ingresos_efectivo - 
            self.total_egresos_efectivo
        )
        
        # ✅ TRANSFERENCIA
        transferencia_mov = movimientos.filter(metodo_pago='transferencia').aggregate(
            ingresos=Sum('monto', filter=Q(tipo='ingreso')),
            egresos=Sum('monto', filter=Q(tipo='egreso'))
        )
        self.transferencia_esperada = (
            (transferencia_mov['ingresos'] or Decimal('0.00')) - 
            (transferencia_mov['egresos'] or Decimal('0.00'))
        )
        
        # ✅ MERCADO PAGO
        mercadopago_mov = movimientos.filter(metodo_pago='mercadopago').aggregate(
            ingresos=Sum('monto', filter=Q(tipo='ingreso')),
            egresos=Sum('monto', filter=Q(tipo='egreso'))
        )
        self.mercadopago_esperado = (
            (mercadopago_mov['ingresos'] or Decimal('0.00')) - 
            (mercadopago_mov['egresos'] or Decimal('0.00'))
        )
        
        # ✅ SEÑAS
        seña_mov = movimientos.filter(metodo_pago='seña').aggregate(
            ingresos=Sum('monto', filter=Q(tipo='ingreso')),
            egresos=Sum('monto', filter=Q(tipo='egreso'))
        )
        self.seña_esperada = (
            (seña_mov['ingresos'] or Decimal('0.00')) - 
            (seña_mov['egresos'] or Decimal('0.00'))
        )
        
        self.save()
    
    def cerrar_turno(self, montos_cierre, observaciones='', usuario=None):
        """Cierra el turno con los montos reales de TODOS los métodos"""
        if self.estado == 'cerrado':
            raise ValueError("El turno ya está cerrado")
        
        # Guardar montos reales
        self.monto_cierre_efectivo = Decimal(str(montos_cierre.get('efectivo', 0)))
        self.monto_cierre_transferencia = Decimal(str(montos_cierre.get('transferencia', 0)))
        self.monto_cierre_mercadopago = Decimal(str(montos_cierre.get('mercadopago', 0)))
        self.monto_cierre_seña = Decimal(str(montos_cierre.get('seña', 0)))
        
        # Calcular diferencias
        self.diferencia_efectivo = self.monto_cierre_efectivo - self.efectivo_esperado
        self.diferencia_transferencia = self.monto_cierre_transferencia - self.transferencia_esperada
        self.diferencia_mercadopago = self.monto_cierre_mercadopago - self.mercadopago_esperado
        self.diferencia_seña = self.monto_cierre_seña - self.seña_esperada
        
        # Diferencia total
        self.diferencia_total = (
            self.diferencia_efectivo + 
            self.diferencia_transferencia + 
            self.diferencia_mercadopago + 
            self.diferencia_seña
        )
        
        self.estado = 'cerrado'
        self.fecha_cierre = timezone.now()
        self.observaciones_cierre = observaciones
        self.usuario_cierre = usuario
        
        self.save()
    
    def get_desglose_metodos(self):
        """Retorna el desglose completo por método de pago"""
        return {
            'efectivo': {
                'esperado': float(self.efectivo_esperado),
                'real': float(self.monto_cierre_efectivo or 0),
                'diferencia': float(self.diferencia_efectivo)
            },
            'transferencia': {
                'esperado': float(self.transferencia_esperada),
                'real': float(self.monto_cierre_transferencia or 0),
                'diferencia': float(self.diferencia_transferencia)
            },
            'mercadopago': {
                'esperado': float(self.mercadopago_esperado),
                'real': float(self.monto_cierre_mercadopago or 0),
                'diferencia': float(self.diferencia_mercadopago)
            },
            'seña': {
                'esperado': float(self.seña_esperada),
                'real': float(self.monto_cierre_seña or 0),
                'diferencia': float(self.diferencia_seña)
            }
        }


class MovimientoCaja(models.Model):
    """
    Modelo para registrar todos los movimientos de caja
    """
    
    TIPO_CHOICES = [
        ('ingreso', 'Ingreso'),
        ('egreso', 'Egreso'),
    ]
    
    CATEGORIA_CHOICES = [
        ('servicios', 'Servicios'),
        ('productos', 'Productos'),
        ('gastos', 'Gastos'),
        ('sueldos', 'Sueldos'),
        ('alquiler', 'Alquiler'),
        ('servicios_publicos', 'Servicios Públicos'),
        ('otros', 'Otros'),
    ]
    
    METODO_PAGO_CHOICES = [
        ('efectivo', 'Efectivo'),
        ('tarjeta', 'Tarjeta'),
        ('transferencia', 'Transferencia'),
        ('mercadopago', 'Mercado Pago'),
        ('seña', 'Seña'),  # ✅ AGREGADO
    ]
    
    # Relaciones
    cierre_caja = models.ForeignKey(
        'CierreCaja',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos',
        help_text="Cierre al que pertenece este movimiento"
    )
    
    turno = models.ForeignKey(
        TurnoCaja,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_turno',
        help_text="Turno al que pertenece este movimiento"
    )
    
    # Campos principales
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    descripcion = models.TextField(blank=True, null=True)
    metodo_pago = models.CharField(
        max_length=20, 
        choices=METODO_PAGO_CHOICES, 
        default='efectivo'
    )
    categoria = models.CharField(
        max_length=50, 
        choices=CATEGORIA_CHOICES,
        default='servicios'
    )
    
    # Fecha y hora
    fecha = models.DateField(auto_now_add=True)
    hora = models.TimeField(auto_now_add=True)
    
    # Relaciones opcionales
    barbero = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='movimientos_caja',
        help_text="Barbero asociado al movimiento"
    )
    
    reserva = models.ForeignKey(
        'reservas.Reserva',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_caja',
        help_text="Reserva asociada (si aplica)"
    )
    
    usuario_registro = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='movimientos_registrados',
        help_text="Usuario que registró el movimiento"
    )
    
    # Campos adicionales
    comprobante = models.ImageField(
        upload_to='comprobantes_caja/', 
        null=True, 
        blank=True,
        help_text="Comprobante del movimiento"
    )
    
    es_editable = models.BooleanField(
        default=True,
        help_text="Si está en un turno cerrado, no se puede editar"
    )
    
    # Metadata
    fecha_creacion = models.DateTimeField(default=timezone.now)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-fecha_creacion']
        verbose_name = 'Movimiento de Caja'
        verbose_name_plural = 'Movimientos de Caja'
        indexes = [
            models.Index(fields=['-fecha_creacion']),
            models.Index(fields=['tipo', 'categoria']),
            models.Index(fields=['cierre_caja']),
            models.Index(fields=['turno']),
        ]
    
    def __str__(self):
        signo = '+' if self.tipo == 'ingreso' else '-'
        desc = self.descripcion[:50] if self.descripcion else 'Sin descripción'
        return f"{signo}${self.monto} - {desc} ({self.fecha})"
    
    @property
    def monto_con_signo(self):
        """Retorna el monto con signo según el tipo"""
        return self.monto if self.tipo == 'ingreso' else -self.monto
    
    def save(self, *args, **kwargs):
        """Verificar si pertenece a un turno cerrado antes de guardar"""
        if self.pk and self.turno and self.turno.estado == 'cerrado':
            self.es_editable = False
        
        super().save(*args, **kwargs)
        
        # Actualizar totales del turno si existe
        if self.turno:
            self.turno.calcular_totales()


class CierreCaja(models.Model):
    """
    Modelo para cierres periódicos de caja
    """
    # Fechas
    fecha_apertura = models.DateTimeField()
    fecha_cierre = models.DateTimeField(default=timezone.now)
    
    # Usuarios
    usuario_apertura = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cierres_apertura',
        help_text="Usuario que abrió la caja"
    )
    usuario_cierre = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cierres_cierre',
        help_text="Usuario que cerró la caja"
    )
    
    # Montos
    monto_inicial = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        help_text="Monto inicial en efectivo al abrir la caja"
    )
    
    # Totales en efectivo
    total_ingresos_efectivo = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0
    )
    total_egresos_efectivo = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0
    )
    
    # Totales otros medios
    total_ingresos_otros = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Total ingresos en tarjeta, transferencia, etc"
    )
    total_egresos_otros = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        help_text="Total egresos en tarjeta, transferencia, etc"
    )
    
    # Efectivo
    efectivo_esperado = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=0,
        help_text="Efectivo que debería haber en caja"
    )
    efectivo_real = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=0,
        help_text="Efectivo contado al cerrar"
    )
    diferencia = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        default=0,
        help_text="Diferencia entre efectivo esperado y real"
    )
    
    # Desgloses
    desglose_metodos = models.JSONField(
        default=dict,
        help_text="Desglose de movimientos por método de pago"
    )
    desglose_categorias = models.JSONField(
        default=dict,
        help_text="Desglose de movimientos por categoría"
    )
    
    # Contadores
    cantidad_movimientos = models.IntegerField(default=0)
    cantidad_ingresos = models.IntegerField(default=0)
    cantidad_egresos = models.IntegerField(default=0)
    
    # Otros
    observaciones = models.TextField(blank=True, null=True)
    esta_cerrado = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-fecha_cierre']
        verbose_name = 'Cierre de Caja'
        verbose_name_plural = 'Cierres de Caja'
        indexes = [
            models.Index(fields=['-fecha_cierre']),
        ]
    
    def __str__(self):
        fecha = self.fecha_cierre.strftime('%d/%m/%Y %H:%M')
        return f"Cierre {self.id} - {fecha}"
    
    @property
    def duracion_turno(self):
        """Calcula la duración del turno en horas"""
        if self.fecha_apertura and self.fecha_cierre:
            delta = self.fecha_cierre - self.fecha_apertura
            return round(delta.total_seconds() / 3600, 2)
        return 0
    
    @property
    def tipo_diferencia(self):
        """Retorna si hay sobrante o faltante"""
        if self.diferencia > 0:
            return "sobrante"
        elif self.diferencia < 0:
            return "faltante"
        return "exacto"