# caja/serializers.py
from rest_framework import serializers
from .models import MovimientoCaja, CierreCaja, TurnoCaja


class TurnoCajaSerializer(serializers.ModelSerializer):
    """Serializer para TurnoCaja con TODOS los métodos de pago"""
    usuario_apertura_nombre = serializers.SerializerMethodField()
    usuario_cierre_nombre = serializers.SerializerMethodField()
    cantidad_movimientos = serializers.SerializerMethodField()
    
    class Meta:
        model = TurnoCaja
        fields = [
            'id',
            'estado',
            'fecha_apertura',
            'monto_apertura',
            'usuario_apertura',
            'usuario_apertura_nombre',
            'fecha_cierre',
            'usuario_cierre',
            'usuario_cierre_nombre',
            'observaciones_cierre',
            
            # ✅ Totales por método de pago
            'total_ingresos_efectivo',
            'total_egresos_efectivo',
            
            # ✅ Esperados por método
            'efectivo_esperado',
            'transferencia_esperada',
            'mercadopago_esperado',
            'seña_esperada',
            
            # ✅ Montos de cierre reales
            'monto_cierre_efectivo',
            'monto_cierre_transferencia',
            'monto_cierre_mercadopago',
            'monto_cierre_seña',
            
            # ✅ Diferencias por método
            'diferencia_efectivo',
            'diferencia_transferencia',
            'diferencia_mercadopago',
            'diferencia_seña',
            'diferencia_total',
            
            'cantidad_movimientos',
            'fecha_creacion',
            'fecha_actualizacion'
        ]
        read_only_fields = [
            'id',
            'estado',
            'fecha_creacion',
            'fecha_actualizacion',
            'total_ingresos_efectivo',
            'total_egresos_efectivo',
            'efectivo_esperado',
            'transferencia_esperada',
            'mercadopago_esperado',
            'seña_esperada',
            'diferencia_efectivo',
            'diferencia_transferencia',
            'diferencia_mercadopago',
            'diferencia_seña',
            'diferencia_total',
            'fecha_cierre',
            'usuario_cierre'
        ]
    
    def get_usuario_apertura_nombre(self, obj):
        if obj.usuario_apertura:
            return obj.usuario_apertura.get_full_name() or obj.usuario_apertura.username
        return None
    
    def get_usuario_cierre_nombre(self, obj):
        if obj.usuario_cierre:
            return obj.usuario_cierre.get_full_name() or obj.usuario_cierre.username
        return None
    
    def get_cantidad_movimientos(self, obj):
        """Retorna la cantidad de movimientos del turno"""
        return obj.movimientos_turno.count()
    
    def validate_monto_apertura(self, value):
        """Validar que el monto de apertura sea positivo"""
        if value < 0:
            raise serializers.ValidationError("El monto de apertura no puede ser negativo")
        return value


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Serializer para MovimientoCaja"""
    turno_estado = serializers.CharField(source='turno.estado', read_only=True)
    usuario_registro_nombre = serializers.SerializerMethodField()
    barbero_nombre = serializers.SerializerMethodField()
    
    # ✅ NUEVOS CAMPOS PARA INFO DE RESERVA
    cliente_nombre = serializers.SerializerMethodField()
    cliente_telefono = serializers.SerializerMethodField()
    reserva_id = serializers.SerializerMethodField()
    
    class Meta:
        model = MovimientoCaja
        fields = [
            'id',
            'cierre_caja',
            'turno',
            'turno_estado',
            'tipo',
            'monto',
            'descripcion',
            'metodo_pago',
            'categoria',
            'fecha',
            'hora',
            'barbero',
            'barbero_nombre',
            'reserva',
            'reserva_id',
            'cliente_nombre',
            'cliente_telefono',
            'usuario_registro',
            'usuario_registro_nombre',
            'comprobante',
            'es_editable',
            'fecha_creacion',
            'fecha_actualizacion'
        ]
        read_only_fields = [
            'id',
            'fecha',
            'hora',
            'fecha_creacion',
            'fecha_actualizacion',
            'es_editable'
        ]
    
    def get_usuario_registro_nombre(self, obj):
        if obj.usuario_registro:
            return obj.usuario_registro.get_full_name() or obj.usuario_registro.username
        return None
    
    def get_barbero_nombre(self, obj):
        if obj.barbero:
            return obj.barbero.get_full_name() or obj.barbero.username
        return None
    
    # ✅ NUEVOS MÉTODOS PARA INFO DE RESERVA
    def get_cliente_nombre(self, obj):
        if obj.reserva:
            return f"{obj.reserva.nombre_cliente} {obj.reserva.apellido_cliente}"
        return None
    
    def get_cliente_telefono(self, obj):
        if obj.reserva:
            return obj.reserva.telefono_cliente
        return None
    
    def get_reserva_id(self, obj):
        if obj.reserva:
            return obj.reserva.id
        return None
    
    def validate_monto(self, value):
        """Validar que el monto sea positivo"""
        if value <= 0:
            raise serializers.ValidationError("El monto debe ser mayor a 0")
        return value
    
    def validate(self, data):
        """Validaciones generales"""
        # Si está actualizando, verificar que el turno no esté cerrado
        if self.instance and self.instance.turno:
            if self.instance.turno.estado == 'cerrado':
                raise serializers.ValidationError(
                    "No se puede modificar un movimiento de un turno cerrado"
                )
        
        # Si el movimiento está asociado a un turno, verificar que esté abierto
        if 'turno' in data and data['turno']:
            if data['turno'].estado == 'cerrado':
                raise serializers.ValidationError(
                    "No se pueden agregar movimientos a un turno cerrado"
                )
        
        return data


class MovimientoCajaDetalladoSerializer(serializers.ModelSerializer):
    """Serializer detallado para exportar historial"""
    turno_info = TurnoCajaSerializer(source='turno', read_only=True)
    usuario_registro_nombre = serializers.SerializerMethodField()
    barbero_nombre = serializers.SerializerMethodField()
    
    class Meta:
        model = MovimientoCaja
        fields = '__all__'
    
    def get_usuario_registro_nombre(self, obj):
        if obj.usuario_registro:
            return obj.usuario_registro.get_full_name() or obj.usuario_registro.username
        return None
    
    def get_barbero_nombre(self, obj):
        if obj.barbero:
            return obj.barbero.get_full_name() or obj.barbero.username
        return None


class CierreCajaSerializer(serializers.ModelSerializer):
    """Serializer para CierreCaja"""
    usuario_apertura_nombre = serializers.SerializerMethodField()
    usuario_cierre_nombre = serializers.SerializerMethodField()
    duracion_turno = serializers.ReadOnlyField()
    tipo_diferencia = serializers.ReadOnlyField()
    
    class Meta:
        model = CierreCaja
        fields = [
            'id',
            'fecha_apertura',
            'fecha_cierre',
            'usuario_apertura',
            'usuario_apertura_nombre',
            'usuario_cierre',
            'usuario_cierre_nombre',
            'monto_inicial',
            'total_ingresos_efectivo',
            'total_egresos_efectivo',
            'total_ingresos_otros',
            'total_egresos_otros',
            'efectivo_esperado',
            'efectivo_real',
            'diferencia',
            'desglose_metodos',
            'desglose_categorias',
            'cantidad_movimientos',
            'cantidad_ingresos',
            'cantidad_egresos',
            'observaciones',
            'esta_cerrado',
            'duracion_turno',
            'tipo_diferencia'
        ]
        read_only_fields = [
            'id',
            'duracion_turno',
            'tipo_diferencia'
        ]
    
    def get_usuario_apertura_nombre(self, obj):
        if obj.usuario_apertura:
            return obj.usuario_apertura.get_full_name() or obj.usuario_apertura.username
        return None
    
    def get_usuario_cierre_nombre(self, obj):
        if obj.usuario_cierre:
            return obj.usuario_cierre.get_full_name() or obj.usuario_cierre.username
        return None


class ResumenTurnoSerializer(serializers.Serializer):
    """Serializer para el resumen de cierre de turno"""
    turno = TurnoCajaSerializer(read_only=True)
    movimientos = MovimientoCajaSerializer(many=True, read_only=True)
    
    # Estadísticas adicionales
    total_ingresos_otros = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_egresos_otros = serializers.DecimalField(max_digits=10, decimal_places=2)
    
    # Desglose por método de pago
    ingresos_por_metodo = serializers.DictField()
    egresos_por_metodo = serializers.DictField()
    
    # Desglose por categoría
    ingresos_por_categoria = serializers.DictField()
    egresos_por_categoria = serializers.DictField()