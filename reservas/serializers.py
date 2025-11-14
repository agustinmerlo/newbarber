# -*- coding: utf-8 -*-
# reservas/serializers.py
from rest_framework import serializers
from caja.models import TurnoCaja
from .models import Reserva


class ReservaSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo Reserva
    """
    pendiente = serializers.SerializerMethodField()
    resto_a_pagar = serializers.SerializerMethodField()
    
    # Campos adicionales del barbero
    barbero_username = serializers.CharField(source='barbero.username', read_only=True)
    barbero_email = serializers.CharField(source='barbero.email', read_only=True)
    
    class Meta:
        model = Reserva
        fields = [
            'id',
            'nombre_cliente',
            'apellido_cliente',
            'telefono_cliente',
            'email_cliente',
            'fecha',
            'horario',
            'barbero',
            'barbero_id',
            'barbero_nombre',
            'barbero_username',
            'barbero_email',
            'servicios',
            'total',
            'seña',
            'saldo_pagado',
            'pendiente',
            'resto_a_pagar',
            'metodo_pago',
            'fecha_pago',
            'estado_pago',
            'duracion_total',
            'comprobante',
            'estado',
            'fecha_creacion',
            'fecha_confirmacion',
            'notas_admin',
        ]
        read_only_fields = [
            'id',
            'fecha_creacion',
            'fecha_confirmacion',
            'barbero_username',
            'barbero_email',
            'pendiente',
            'resto_a_pagar',
            'estado_pago'
        ]

    def get_pendiente(self, obj):
        return obj.pendiente

    def get_resto_a_pagar(self, obj):
        return obj.resto_a_pagar

    def validate_saldo_pagado(self, value):
        """
        Validar que el saldo pagado no exceda el total
        """
        if self.instance:
            seña = self.instance.seña or 0
            total = self.instance.total or 0
            
            if (seña + value) > total:
                raise serializers.ValidationError(
                    f"El saldo pagado (${value}) + la seña (${seña}) "
                    f"no puede exceder el total (${total})"
                )
        
        return value

    def validate(self, data):
        """
        Validaciones generales
        """
        if 'saldo_pagado' in data and self.instance:
            nuevo_saldo = data['saldo_pagado']
            saldo_anterior = self.instance.saldo_pagado or 0
            
            if nuevo_saldo > saldo_anterior:
                turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
                
                if not turno_activo:
                    raise serializers.ValidationError({
                        'caja': 'No se pueden registrar pagos. La caja está cerrada. Por favor, abre la caja primero.'
                    })
        
        return data

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance


class ReservaCreateSerializer(serializers.Serializer):
    """
    Serializador específico para crear reservas
    """
    reserva = serializers.JSONField()
    cliente = serializers.JSONField()
    comprobante = serializers.ImageField()
    monto = serializers.DecimalField(max_digits=10, decimal_places=2) 