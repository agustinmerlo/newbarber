from django.contrib import admin
from django.utils.html import format_html
from .models import MovimientoCaja, TurnoCaja

@admin.register(MovimientoCaja)
class MovimientoCajaAdmin(admin.ModelAdmin):
    list_display = ('id', 'tipo', 'monto_formateado', 'descripcion', 'metodo_pago', 
                    'categoria', 'fecha', 'hora', 'turno', 'es_editable')
    list_filter = ('tipo', 'metodo_pago', 'categoria', 'fecha', 'turno')
    search_fields = ('descripcion',)
    readonly_fields = ('hora', 'es_editable')
    ordering = ('-fecha', '-hora')
    
    def monto_formateado(self, obj):
        color = '#4caf50' if obj.tipo == 'ingreso' else '#f44336'
        return format_html(
            '<span style="color: {}; font-weight: bold;">${:,.2f}</span>',
            color,
            obj.monto
        )
    monto_formateado.short_description = 'Monto'

@admin.register(TurnoCaja)
class TurnoCajaAdmin(admin.ModelAdmin):
    list_display = ('id', 'fecha_apertura', 'fecha_cierre', 'estado_badge', 
                    'monto_apertura', 'total_movimientos', 'diferencia_total_formateada')
    list_filter = ('fecha_apertura', 'fecha_cierre')
    readonly_fields = ('fecha_apertura', 'fecha_cierre', 
                       'efectivo_esperado', 'transferencia_esperada', 
                       'mercadopago_esperado', 'seña_esperada',
                       'diferencia_efectivo', 'diferencia_transferencia',
                       'diferencia_mercadopago', 'diferencia_seña', 
                       'diferencia_total')
    ordering = ('-fecha_apertura',)
    
    fieldsets = (
        ('Información General', {
            'fields': ('monto_apertura', 'fecha_apertura', 'fecha_cierre')
        }),
        ('Montos Esperados', {
            'fields': ('efectivo_esperado', 'transferencia_esperada', 
                      'mercadopago_esperado', 'seña_esperada'),
            'classes': ('collapse',)
        }),
        ('Cierre - Montos Reales', {
            'fields': ('monto_cierre_efectivo', 'monto_cierre_transferencia',
                      'monto_cierre_mercadopago', 'monto_cierre_seña',
                      'observaciones_cierre'),
            'classes': ('collapse',)
        }),
        ('Diferencias', {
            'fields': ('diferencia_efectivo', 'diferencia_transferencia',
                      'diferencia_mercadopago', 'diferencia_seña', 'diferencia_total'),
            'classes': ('collapse',)
        }),
    )
    
    def estado_badge(self, obj):
        if obj.fecha_cierre:
            return format_html(
                '<span style="background: #f44336; color: white; padding: 4px 12px; '
                'border-radius: 12px; font-size: 11px; font-weight: bold;">CERRADO</span>'
            )
        return format_html(
            '<span style="background: #4caf50; color: white; padding: 4px 12px; '
            'border-radius: 12px; font-size: 11px; font-weight: bold;">ACTIVO</span>'
        )
    estado_badge.short_description = 'Estado'
    
    def total_movimientos(self, obj):
        count = obj.movimientos.count()
        return format_html(
            '<span style="font-weight: bold; color: #2196f3;">{}</span>',
            count
        )
    total_movimientos.short_description = 'Movimientos'
    
    def diferencia_total_formateada(self, obj):
        if not obj.fecha_cierre:
            return '-'
        color = '#4caf50' if obj.diferencia_total >= 0 else '#f44336'
        simbolo = '✅' if obj.diferencia_total >= 0 else '⚠️'
        return format_html(
            '<span style="color: {}; font-weight: bold;">{} ${:,.2f}</span>',
            color,
            simbolo,
            abs(obj.diferencia_total)
        )
    diferencia_total_formateada.short_description = 'Diferencia Total'