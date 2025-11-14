# reservas/admin.py
from django.contrib import admin
from .models import Reserva


@admin.register(Reserva)
class ReservaAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'cliente_nombre_completo', 'fecha', 'horario', 
        'barbero_nombre', 'total', 'estado', 'estado_pago', 'pendiente'
    ]
    list_filter = ['estado', 'estado_pago', 'fecha', 'barbero']
    search_fields = [
        'nombre_cliente', 'apellido_cliente', 
        'email_cliente', 'telefono_cliente'
    ]
    date_hierarchy = 'fecha'
    ordering = ['-fecha_creacion']
    readonly_fields = [
        'fecha_creacion', 'fecha_confirmacion', 'pendiente', 
        'resto_a_pagar', 'estado_pago', 'porcentaje_pagado'
    ]
    
    fieldsets = (
        ('Información del Cliente', {
            'fields': (
                'nombre_cliente', 'apellido_cliente', 
                'telefono_cliente', 'email_cliente'
            )
        }),
        ('Detalles de la Reserva', {
            'fields': (
                'fecha', 'horario', 'barbero', 'barbero_nombre',
                'servicios', 'duracion_total'
            )
        }),
        ('Información de Pago', {
            'fields': (
                'total', 'seña', 'saldo_pagado', 'pendiente',
                'metodo_pago', 'fecha_pago', 'estado_pago',
                'porcentaje_pagado', 'comprobante'
            )
        }),
        ('Estado y Fechas', {
            'fields': (
                'estado', 'fecha_creacion', 'fecha_confirmacion', 'notas_admin'
            )
        }),
    )
    
    def cliente_nombre_completo(self, obj):
        return obj.cliente_nombre_completo
    cliente_nombre_completo.short_description = 'Cliente'