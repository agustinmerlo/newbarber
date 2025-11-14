# caja/admin.py
from django.contrib import admin
from .models import MovimientoCaja, CierreCaja, TurnoCaja


@admin.register(TurnoCaja)
class TurnoCajaAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'estado', 'fecha_apertura', 'monto_apertura', 
        'usuario_apertura', 'efectivo_esperado', 'monto_cierre', 'diferencia'
    ]
    list_filter = ['estado', 'fecha_apertura']
    search_fields = ['usuario_apertura__username', 'observaciones_cierre']
    date_hierarchy = 'fecha_apertura'
    ordering = ['-fecha_apertura']
    readonly_fields = [
        'total_ingresos_efectivo', 'total_egresos_efectivo', 
        'efectivo_esperado', 'diferencia', 'fecha_creacion', 'fecha_actualizacion'
    ]


@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'tipo', 'monto', 'descripcion_corta', 'metodo_pago', 
        'categoria', 'fecha', 'turno', 'es_editable'
    ]
    list_filter = ['tipo', 'metodo_pago', 'categoria', 'fecha', 'es_editable']
    search_fields = ['descripcion', 'reserva__nombre_cliente']
    date_hierarchy = 'fecha'
    ordering = ['-fecha_creacion']
    readonly_fields = ['fecha', 'hora', 'fecha_creacion', 'fecha_actualizacion', 'es_editable']
    
    def descripcion_corta(self, obj):
        return obj.descripcion[:50] + '...' if len(obj.descripcion) > 50 else obj.descripcion
    descripcion_corta.short_description = 'Descripción'


@admin.register(CierreCaja)
class CierreCajaAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'fecha_cierre', 'monto_inicial', 'efectivo_esperado', 
        'efectivo_real', 'diferencia', 'cantidad_movimientos'
    ]
    list_filter = ['fecha_cierre', 'esta_cerrado']
    search_fields = ['observaciones']
    date_hierarchy = 'fecha_cierre'
    ordering = ['-fecha_cierre']
    readonly_fields = ['fecha_cierre', 'duracion_turno', 'tipo_diferencia']