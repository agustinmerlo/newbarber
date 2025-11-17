# caja/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Sum, Q
from decimal import Decimal

from .models import MovimientoCaja, CierreCaja, TurnoCaja
from .serializers import (
    MovimientoCajaSerializer,
    CierreCajaSerializer,
    TurnoCajaSerializer,
    ResumenTurnoSerializer,
    MovimientoCajaDetalladoSerializer
)


class TurnoCajaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar turnos de caja con TODOS los métodos de pago
    """
    queryset = TurnoCaja.objects.all()
    serializer_class = TurnoCajaSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """Filtrar turnos"""
        queryset = TurnoCaja.objects.all()
        
        # Filtros
        estado = self.request.query_params.get('estado')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        
        if estado:
            queryset = queryset.filter(estado=estado)
        if fecha_desde:
            queryset = queryset.filter(fecha_apertura__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha_apertura__lte=fecha_hasta)
        
        return queryset.order_by('-fecha_apertura')
    
    def perform_create(self, serializer):
        """Crear turno asociando usuario"""
        turno = serializer.save(
            usuario_apertura=self.request.user if self.request.user.is_authenticated else None
        )
        # Inicializar totales
        turno.calcular_totales()
    
    @action(detail=False, methods=['get'])
    def turno_activo(self, request):
        """
        GET /api/caja/turnos/turno_activo/
        Obtiene el turno actualmente abierto (si existe)
        """
        turno_abierto = TurnoCaja.objects.filter(estado='abierto').first()
        
        if not turno_abierto:
            return Response({
                'existe': False,
                'mensaje': 'No hay ningún turno abierto'
            }, status=200)
        
        # Actualizar totales antes de devolver
        turno_abierto.calcular_totales()
        
        serializer = TurnoCajaSerializer(turno_abierto)
        return Response({
            'existe': True,
            'turno': serializer.data
        }, status=200)
    
    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        """
        POST /api/caja/turnos/{id}/cerrar/
        Cierra un turno de caja con TODOS los métodos de pago
        
        Body esperado:
        {
            "monto_cierre_efectivo": 15000.50,
            "monto_cierre_transferencia": 8000.00,
            "monto_cierre_mercadopago": 5000.00,
            "monto_cierre_seña": 2000.00,
            "observaciones": "Todo correcto"
        }
        """
        turno = self.get_object()
        
        if turno.estado == 'cerrado':
            return Response({
                'error': 'Este turno ya está cerrado'
            }, status=400)
        
        # Obtener montos de cierre
        try:
            montos_cierre = {
                'efectivo': Decimal(str(request.data.get('monto_cierre_efectivo', 0))),
                'transferencia': Decimal(str(request.data.get('monto_cierre_transferencia', 0))),
                'mercadopago': Decimal(str(request.data.get('monto_cierre_mercadopago', 0))),
                'seña': Decimal(str(request.data.get('monto_cierre_seña', 0))),
            }
            
            # Validar que sean números positivos
            for metodo, monto in montos_cierre.items():
                if monto < 0:
                    return Response({
                        'error': f'El monto de {metodo} no puede ser negativo'
                    }, status=400)
                    
        except (ValueError, TypeError) as e:
            return Response({
                'error': 'Los montos de cierre deben ser números válidos'
            }, status=400)
        
        observaciones = request.data.get('observaciones', '')
        
        # Cerrar el turno
        try:
            turno.cerrar_turno(
                montos_cierre=montos_cierre,
                observaciones=observaciones,
                usuario=request.user if request.user.is_authenticated else None
            )
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=400)
        
        # Marcar todos los movimientos del turno como no editables
        turno.movimientos_turno.update(es_editable=False)
        
        serializer = TurnoCajaSerializer(turno)
        return Response({
            'mensaje': 'Turno cerrado exitosamente',
            'turno': serializer.data
        }, status=200)
    
    @action(detail=True, methods=['get'])
    def resumen(self, request, pk=None):
        """
        GET /api/caja/turnos/{id}/resumen/
        Obtiene un resumen completo del turno con desglose por TODOS los métodos
        """
        turno = self.get_object()
        movimientos = turno.movimientos_turno.all()
        
        # ✅ Calcular totales por TODOS los métodos de pago
        metodos = ['efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'seña']
        
        ingresos_por_metodo = {}
        egresos_por_metodo = {}
        
        for metodo in metodos:
            ingresos_por_metodo[metodo] = float(
                sum(m.monto for m in movimientos.filter(
                    tipo='ingreso',
                    metodo_pago=metodo
                )) or Decimal('0')
            )
            egresos_por_metodo[metodo] = float(
                sum(m.monto for m in movimientos.filter(
                    tipo='egreso',
                    metodo_pago=metodo
                )) or Decimal('0')
            )
        
        # Calcular totales por categoría
        ingresos_por_categoria = {}
        egresos_por_categoria = {}
        
        categorias = ['servicios', 'productos', 'gastos', 'sueldos', 
                     'alquiler', 'servicios_publicos', 'otros']
        
        for cat in categorias:
            ingresos_por_categoria[cat] = float(
                sum(m.monto for m in movimientos.filter(
                    tipo='ingreso',
                    categoria=cat
                )) or Decimal('0')
            )
            egresos_por_categoria[cat] = float(
                sum(m.monto for m in movimientos.filter(
                    tipo='egreso',
                    categoria=cat
                )) or Decimal('0')
            )
        
        # Total de ingresos/egresos NO en efectivo
        total_ingresos_otros = float(
            sum(m.monto for m in movimientos.filter(
                tipo='ingreso'
            ).exclude(metodo_pago='efectivo')) or Decimal('0')
        )
        
        total_egresos_otros = float(
            sum(m.monto for m in movimientos.filter(
                tipo='egreso'
            ).exclude(metodo_pago='efectivo')) or Decimal('0')
        )
        
        # Serializar datos
        turno_data = TurnoCajaSerializer(turno).data
        movimientos_data = MovimientoCajaSerializer(movimientos, many=True).data
        
        return Response({
            'turno': turno_data,
            'movimientos': movimientos_data,
            'total_ingresos_otros': total_ingresos_otros,
            'total_egresos_otros': total_egresos_otros,
            'ingresos_por_metodo': ingresos_por_metodo,
            'egresos_por_metodo': egresos_por_metodo,
            'ingresos_por_categoria': ingresos_por_categoria,
            'egresos_por_categoria': egresos_por_categoria
        }, status=200)
    
    @action(detail=False, methods=['get'])
    def historial(self, request):
        """
        GET /api/caja/turnos/historial/
        Obtiene el historial de todos los turnos cerrados
        """
        turnos_cerrados = TurnoCaja.objects.filter(estado='cerrado')
        
        # Filtros
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        
        if fecha_desde:
            turnos_cerrados = turnos_cerrados.filter(fecha_cierre__gte=fecha_desde)
        if fecha_hasta:
            turnos_cerrados = turnos_cerrados.filter(fecha_cierre__lte=fecha_hasta)
        
        serializer = TurnoCajaSerializer(turnos_cerrados, many=True)
        return Response({
            'cantidad': turnos_cerrados.count(),
            'turnos': serializer.data
        }, status=200)


# caja/views.py - Actualiza el método get_queryset

class MovimientoCajaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para CRUD completo de MovimientoCaja
    """
    queryset = MovimientoCaja.objects.all()
    serializer_class = MovimientoCajaSerializer
    permission_classes = [AllowAny]
    
    def get_queryset(self):
        """Aplicar filtros desde query params"""
        # ✅ USAR distinct() PARA EVITAR DUPLICADOS
        queryset = MovimientoCaja.objects.select_related(
            'turno', 
            'barbero', 
            'usuario_registro',
            'reserva'
        ).distinct()
        
        # Filtros
        tipo = self.request.query_params.get('tipo')
        categoria = self.request.query_params.get('categoria')
        metodo_pago = self.request.query_params.get('metodo_pago')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        turno_id = self.request.query_params.get('turno')
        solo_editables = self.request.query_params.get('solo_editables')
        
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        if categoria:
            queryset = queryset.filter(categoria=categoria)
        if metodo_pago:
            queryset = queryset.filter(metodo_pago=metodo_pago)
        if fecha_desde:
            queryset = queryset.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__lte=fecha_hasta)
        if turno_id:
            queryset = queryset.filter(turno_id=turno_id)
        if solo_editables == 'true':
            queryset = queryset.filter(es_editable=True)
        
        # ✅ ORDENAR CONSISTENTEMENTE
        return queryset.order_by('-fecha_creacion', '-id')
    
    def perform_create(self, serializer):
        """Asociar usuario y turno activo al crear"""
        # Buscar turno activo
        turno_activo = TurnoCaja.objects.filter(estado='abierto').first()
        
        if not turno_activo:
            raise ValueError("No hay un turno de caja abierto. Debes abrir la caja primero.")
        
        serializer.save(
            usuario_registro=self.request.user if self.request.user.is_authenticated else None,
            turno=turno_activo
        )
    
    def update(self, request, *args, **kwargs):
        """Verificar que el movimiento sea editable antes de actualizar"""
        instance = self.get_object()
        
        if not instance.es_editable:
            return Response({
                'error': 'Este movimiento no puede ser editado porque pertenece a un turno cerrado'
            }, status=400)
        
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        """Verificar que el movimiento sea editable antes de eliminar"""
        instance = self.get_object()
        
        if not instance.es_editable:
            return Response({
                'error': 'Este movimiento no puede ser eliminado porque pertenece a un turno cerrado'
            }, status=400)
        
        return super().destroy(request, *args, **kwargs)
    
    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        """
        GET /api/caja/movimientos/estadisticas/
        Devuelve estadísticas generales de la caja con TODOS los métodos
        """
        fecha_desde = request.query_params.get('fecha_desde')
        fecha_hasta = request.query_params.get('fecha_hasta')
        
        movimientos = MovimientoCaja.objects.all()
        
        if fecha_desde:
            movimientos = movimientos.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            movimientos = movimientos.filter(fecha__lte=fecha_hasta)
        
        # Totales generales
        total_ingresos = movimientos.filter(tipo='ingreso').aggregate(
            total=Sum('monto')
        )['total'] or Decimal('0')
        
        total_egresos = movimientos.filter(tipo='egreso').aggregate(
            total=Sum('monto')
        )['total'] or Decimal('0')
        
        saldo = total_ingresos - total_egresos
        
        # ✅ Estadísticas por TODOS los métodos de pago
        metodos = ['efectivo', 'tarjeta', 'transferencia', 'mercadopago', 'seña']
        por_metodo = {}
        
        for metodo in metodos:
            ingresos = movimientos.filter(
                tipo='ingreso', 
                metodo_pago=metodo
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            
            egresos = movimientos.filter(
                tipo='egreso', 
                metodo_pago=metodo
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            
            por_metodo[metodo] = {
                'ingresos': float(ingresos),
                'egresos': float(egresos),
                'saldo': float(ingresos - egresos)
            }
        
        # Estadísticas por categoría
        por_categoria = {}
        categorias = ['servicios', 'productos', 'gastos', 'sueldos', 
                     'alquiler', 'servicios_publicos', 'otros']
        
        for cat in categorias:
            ingresos = movimientos.filter(
                tipo='ingreso', 
                categoria=cat
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            
            egresos = movimientos.filter(
                tipo='egreso', 
                categoria=cat
            ).aggregate(total=Sum('monto'))['total'] or Decimal('0')
            
            por_categoria[cat] = {
                'ingresos': float(ingresos),
                'egresos': float(egresos),
                'saldo': float(ingresos - egresos)
            }
        
        return Response({
            'total_ingresos': float(total_ingresos),
            'total_egresos': float(total_egresos),
            'saldo': float(saldo),
            'cantidad_movimientos': movimientos.count(),
            'por_metodo_pago': por_metodo,
            'por_categoria': por_categoria,
            'fecha_desde': fecha_desde,
            'fecha_hasta': fecha_hasta
        }, status=200)


class CierreCajaViewSet(viewsets.ModelViewSet):
    """ViewSet para CRUD de CierreCaja periódicos"""
    queryset = CierreCaja.objects.all()
    serializer_class = CierreCajaSerializer
    permission_classes = [AllowAny]
    
    def perform_create(self, serializer):
        """Calcular totales al crear un cierre"""
        cierre = serializer.save(
            usuario_cierre=self.request.user if self.request.user.is_authenticated else None
        )