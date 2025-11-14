# -*- coding: utf-8 -*-
# reservas/views.py

import json
import sys
from datetime import datetime, time, timedelta
from decimal import Decimal

# ✅ FORZAR UTF-8 A NIVEL DE SISTEMA
if sys.version_info[0] >= 3:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Reserva
from .serializers import ReservaSerializer, ReservaCreateSerializer
from caja.models import MovimientoCaja, TurnoCaja
from caja.utils import validar_caja_abierta, obtener_turno_activo, registrar_pago_en_caja


# ==========================================
# UTILIDADES
# ==========================================
def enviar_email_utf8(asunto, mensaje, destinatario):
    """
    Envía un email asegurando codificación UTF-8
    """
    try:
        if isinstance(mensaje, str):
            mensaje = mensaje.encode('utf-8').decode('utf-8')
        if isinstance(asunto, str):
            asunto = asunto.encode('utf-8').decode('utf-8')
        email = EmailMessage(
            subject=asunto,
            body=mensaje,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[destinatario],
        )
        email.content_subtype = "plain"
        email.encoding = 'utf-8'
        email.send(fail_silently=False)
        print(f"✅ Email enviado exitosamente a: {destinatario}")
        return True
    except UnicodeEncodeError as e:
        print(f"❌ Error de codificación UTF-8: {e}")
        try:
            mensaje_simple = mensaje.replace('ñ', 'n').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            asunto_simple = asunto.replace('ñ', 'n').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
            email = EmailMessage(
                subject=asunto_simple,
                body=mensaje_simple,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[destinatario],
            )
            email.send(fail_silently=True)
            print(f"⚠️ Email enviado SIN acentos a: {destinatario}")
            return True
        except Exception as e2:
            print(f"❌ Error enviando email sin acentos: {e2}")
            return False
    except Exception as e:
        print(f"❌ Error general al enviar email: {e}")
        return False


def _dt(fecha, hora):
    """Combina Date + Time en un datetime aware para comparar."""
    if isinstance(hora, str):
        hora = datetime.strptime(hora, "%H:%M").time()
    naive = datetime.combine(fecha, hora)
    return timezone.make_aware(naive, timezone.get_current_timezone())


# ==========================================
# HORARIOS DISPONIBLES
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def horarios_disponibles(request):
    """
    GET /api/horarios/?fecha=YYYY-MM-DD&barbero=ID&duracion_min=...
    Turnos de 1 hora (9-12 y 17-21), bloquea pendientes/confirmadas.
    """
    fecha_str = (request.query_params.get('fecha') or request.query_params.get('date'))
    barbero_id = (request.query_params.get('barbero') or request.query_params.get('barber') or request.query_params.get('barbero_id'))
    duracion_min = request.query_params.get('duracion_min')

    if not fecha_str or not barbero_id:
        return Response({"detail": "Parámetros requeridos: fecha y barbero"}, status=400)

    fecha = parse_date(fecha_str)
    if not fecha:
        return Response({"detail": "fecha inválida (YYYY-MM-DD)"}, status=400)

    try:
        barbero_id = int(barbero_id)
    except ValueError:
        return Response({"detail": "barbero debe ser entero"}, status=400)

    duracion_minutos = int(duracion_min) if duracion_min else 60
    bloques_necesarios = max(1, duracion_minutos // 60)

    horarios_manana = [time(9, 0), time(10, 0), time(11, 0), time(12, 0)]
    horarios_tarde  = [time(17, 0), time(18, 0), time(19, 0), time(20, 0), time(21, 0)]
    todos_horarios = horarios_manana + horarios_tarde

    reservas = (
        Reserva.objects
        .filter(barbero_id=barbero_id, fecha=fecha)
        .exclude(estado__in=['cancelada', 'rechazada'])
        .only('horario', 'duracion_total')
    )

    ocupados = set()
    for r in reservas:
        inicio_dt = _dt(fecha, r.horario)
        horas = (r.duracion_total or 60) / 60
        horas = int(horas) if horas == int(horas) else int(horas) + 1
        for i in range(horas):
            ocupados.add((inicio_dt + timedelta(hours=i)).strftime('%H:%M'))

    slots = []
    for h in todos_horarios:
        hstr = h.strftime('%H:%M')
        disponible = hstr not in ocupados

        if disponible and bloques_necesarios > 1:
            base = _dt(fecha, h)
            for i in range(1, bloques_necesarios):
                siguiente = (base + timedelta(hours=i)).strftime('%H:%M')
                if siguiente in ocupados or siguiente not in [x.strftime('%H:%M') for x in todos_horarios]:
                    disponible = False
                    break

        slots.append({"hora": hstr, "disponible": disponible})

    return Response({
        "fecha": fecha_str,
        "barbero": barbero_id,
        "intervalo_min": 60,
        "duracion_min_requerida": duracion_minutos,
        "slots": slots,
        "horarios_ocupados": list(ocupados)
    })


# ==========================================
# CREAR NUEVA RESERVA
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def crear_reserva(request):
    """
    POST /api/reservas/crear/
    Crea una nueva reserva con seña (NO requiere caja abierta en este momento)
    """
    try:
        reserva_raw = request.data.get('reserva')
        cliente_raw = request.data.get('cliente')
        comprobante = request.FILES.get('comprobante')
        monto = request.data.get('monto')

        if not reserva_raw:
            return Response({'error': 'Falta el campo: reserva'}, status=400)
        if not cliente_raw:
            return Response({'error': 'Falta el campo: cliente'}, status=400)
        if not comprobante:
            return Response({'error': 'Debe adjuntar un comprobante de pago'}, status=400)
        if not monto:
            return Response({'error': 'Falta el campo: monto'}, status=400)

        try:
            reserva_data = json.loads(reserva_raw)
            cliente_data = json.loads(cliente_raw)
        except json.JSONDecodeError as e:
            return Response({'error': f'Error al parsear JSON: {str(e)}'}, status=400)

        try:
            monto_decimal = Decimal(str(monto))
            total_decimal = Decimal(str(reserva_data.get('total', 0)))
        except:
            return Response({'error': 'Monto inválido'}, status=400)

        if not all(k in reserva_data for k in ['fecha', 'horario', 'barbero', 'servicios', 'total', 'duracionTotal']):
            return Response({'error': 'Faltan campos en reserva'}, status=400)

        if not all(k in cliente_data for k in ['nombre', 'apellido', 'telefono', 'email']):
            return Response({'error': 'Faltan campos en cliente'}, status=400)

        try:
            fecha_res = parse_date(reserva_data['fecha'])
            if not fecha_res:
                raise ValueError("Fecha inválida")
            hora_inicio_str = reserva_data['horario']
            hora_inicio = datetime.strptime(hora_inicio_str, "%H:%M").time()
            duracion = int(reserva_data.get('duracionTotal', 0))
            if duracion <= 0:
                return Response({'error': 'Duración inválida'}, status=400)
        except Exception as e:
            return Response({'error': f'Error en fecha/horario: {str(e)}'}, status=400)

        inicio_dt = datetime.combine(fecha_res, hora_inicio)
        fin_dt = inicio_dt + timedelta(minutes=duracion)

        # Validar disponibilidad
        ocupadas = (
            Reserva.objects
            .filter(barbero_id=reserva_data['barbero']['id'], fecha=fecha_res)
            .exclude(estado__in=['cancelada', 'rechazada'])
        )

        for r in ocupadas:
            r_inicio = datetime.combine(fecha_res, r.horario)
            r_fin = r_inicio + timedelta(minutes=r.duracion_total or 0)
            if inicio_dt < r_fin and fin_dt > r_inicio:
                return Response({
                    'error': f'El horario {hora_inicio_str} ya está ocupado. Por favor selecciona otro horario.'
                }, status=400)

        # Crear reserva
        reserva = Reserva.objects.create(
            nombre_cliente=cliente_data.get('nombre', ''),
            apellido_cliente=cliente_data.get('apellido', ''),
            telefono_cliente=cliente_data.get('telefono', ''),
            email_cliente=cliente_data.get('email', ''),
            fecha=reserva_data['fecha'],
            horario=reserva_data['horario'],
            barbero_id=reserva_data['barbero']['id'],
            barbero_nombre=reserva_data['barbero'].get('nombre', ''),
            servicios=reserva_data.get('servicios', []),
            total=total_decimal,
            seña=monto_decimal,
            duracion_total=int(reserva_data.get('duracionTotal', 0)),
            comprobante=comprobante,
            estado='pendiente',
            estado_pago='sin_pagar'
        )

        # Enviar email de confirmación
        mensaje = f'''Hola {cliente_data.get("nombre", "")},

Gracias por elegirnos! Hemos recibido tu comprobante de pago.

DETALLES DE TU RESERVA:
- Fecha: {reserva.fecha}
- Hora: {reserva.horario}
- Barbero: {reserva.barbero_nombre}
- Sena pagada: ${reserva.seña}

Tu reserva esta siendo verificada por nuestro equipo.
Te confirmaremos en las proximas 24 horas.

Nos vemos pronto!
Barberia Clase V'''

        enviar_email_utf8(
            'Reserva Recibida - Barberia Clase V',
            mensaje,
            cliente_data.get('email', '')
        )

        serializer = ReservaSerializer(reserva)
        return Response({
            'id': reserva.id,
            'estado': 'pendiente',
            'mensaje': 'Reserva creada exitosamente. La seña se registrará en caja al confirmar.',
            'data': serializer.data
        }, status=201)

    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': f'Error al crear reserva: {str(e)}'}, status=500)


# ==========================================
# CONFIRMAR RESERVA
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def confirmar_reserva(request, reserva_id):
    """
    POST /api/reservas/<id>/confirmar/
    Confirma la reserva y registra la seña en caja
    """
    try:
        reserva = Reserva.objects.get(id=reserva_id)
        
        # 🔒 VALIDAR CAJA ABIERTA
        try:
            turno_activo = validar_caja_abierta()
        except ValidationError as e:
            error_detail = e.detail if hasattr(e, 'detail') else str(e)
            print(f"❌ Intento de confirmar reserva #{reserva_id} con caja cerrada")
            return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar que no esté ya confirmada
        if reserva.estado == 'confirmada':
            return Response({
                'error': 'Reserva ya confirmada',
                'mensaje': 'Esta reserva ya fue confirmada anteriormente.',
                'estado_actual': reserva.estado
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Actualizar estado
        reserva.estado = 'confirmada'
        reserva.fecha_confirmacion = timezone.now()
        reserva.save()

        # 💰 REGISTRAR SEÑA EN CAJA
        if reserva.seña and reserva.seña > 0:
            try:
                movimiento = registrar_pago_en_caja(
                    reserva=reserva,
                    monto=reserva.seña,
                    metodo_pago='transferencia',
                    tipo_pago='seña',
                    usuario=request.user if request.user.is_authenticated else None
                )
                print(f"✅ Seña de ${reserva.seña} registrada en caja (Movimiento #{movimiento.id})")
            except Exception as e:
                print(f"❌ Error al registrar seña en caja: {e}")
                # Revertir confirmación si falla el registro en caja
                reserva.estado = 'pendiente'
                reserva.fecha_confirmacion = None
                reserva.save()
                return Response({
                    'error': 'Error al registrar en caja',
                    'mensaje': f'No se pudo registrar la seña en caja: {str(e)}',
                    'sugerencia': 'Verifica que la caja esté abierta e intenta nuevamente.'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Enviar email de confirmación
        mensaje_cliente = f'''Hola {reserva.nombre_cliente},

EXCELENTES NOTICIAS! Tu reserva ha sido CONFIRMADA.

DETALLES DE TU CITA:
- Fecha: {reserva.fecha.strftime("%d/%m/%Y")}
- Hora: {reserva.horario.strftime("%H:%M")}
- Barbero: {reserva.barbero_nombre}

PAGO:
- Total: ${reserva.total}
- Sena pagada: ${reserva.seña}
- Resto a pagar: ${reserva.resto_a_pagar}

Te esperamos!
Barberia Clase V'''

        enviar_email_utf8(
            'Reserva Confirmada - Barberia Clase V',
            mensaje_cliente,
            reserva.email_cliente
        )

        serializer = ReservaSerializer(reserva)
        return Response({
            'success': True,
            'mensaje': 'Reserva confirmada y seña registrada en caja exitosamente', 
            'data': serializer.data
        }, status=200)
        
    except Reserva.DoesNotExist:
        return Response({
            'error': 'Reserva no encontrada',
            'mensaje': f'No existe una reserva con el ID {reserva_id}'
        }, status=404)
    except Exception as e:
        print(f"❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': 'Error del servidor',
            'mensaje': str(e)
        }, status=500)


# ==========================================
# RECHAZAR RESERVA
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def rechazar_reserva(request, reserva_id):
    """
    POST /api/reservas/<id>/rechazar/
    """
    try:
        reserva = Reserva.objects.get(id=reserva_id)
        motivo = request.data.get('motivo', 'Comprobante invalido')
        reserva.estado = 'rechazada'
        reserva.notas_admin = motivo
        reserva.save()

        mensaje = f'''Hola {reserva.nombre_cliente},

No pudimos verificar tu comprobante.

MOTIVO: {motivo}

Contactanos para resolverlo.

Barberia Clase V'''

        enviar_email_utf8(
            'Problema con tu Reserva - Barberia Clase V',
            mensaje,
            reserva.email_cliente
        )

        serializer = ReservaSerializer(reserva)
        return Response({'mensaje': 'Reserva rechazada', 'data': serializer.data}, status=200)
    except Reserva.DoesNotExist:
        return Response({'error': 'Reserva no encontrada'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


# ==========================================
# PAGAR SALDO
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def pagar_saldo(request, reserva_id):
    """
    POST /api/reservas/{id}/pagar_saldo/
    Registra el pago del saldo restante de una reserva
    
    Body:
    {
        "monto": 5000,
        "metodo_pago": "efectivo"
    }
    """
    try:
        reserva = Reserva.objects.get(id=reserva_id)
    except Reserva.DoesNotExist:
        return Response({
            'error': 'Reserva no encontrada',
            'mensaje': f'No existe una reserva con el ID {reserva_id}'
        }, status=status.HTTP_404_NOT_FOUND)
    
    # 🔒 VALIDAR CAJA ABIERTA
    try:
        turno_activo = validar_caja_abierta()
    except ValidationError as e:
        error_detail = e.detail if hasattr(e, 'detail') else str(e)
        print(f"❌ Intento de pagar saldo con caja cerrada - Reserva #{reserva.id}")
        return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
    
    # Validar que no esté completamente pagada
    if reserva.esta_completamente_pagado:
        return Response({
            'error': 'Reserva ya pagada',
            'mensaje': 'Esta reserva ya está completamente pagada',
            'total': float(reserva.total),
            'pagado': float(reserva.seña + reserva.saldo_pagado),
            'pendiente': 0
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener datos
    monto = request.data.get('monto')
    metodo_pago = request.data.get('metodo_pago', 'efectivo')
    
    if not monto:
        return Response({
            'error': 'Monto requerido',
            'mensaje': 'Debes proporcionar el monto del pago',
            'pendiente_actual': float(reserva.pendiente)
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        monto = Decimal(str(monto))
        if monto <= 0:
            return Response({
                'error': 'Monto inválido',
                'mensaje': 'El monto debe ser mayor a 0'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar que no pague más de lo que debe
        if monto > Decimal(str(reserva.pendiente)):
            return Response({
                'error': 'Monto excedido',
                'mensaje': f'El monto no puede ser mayor al pendiente',
                'monto_recibido': float(monto),
                'pendiente': float(reserva.pendiente),
                'diferencia': float(monto - Decimal(str(reserva.pendiente)))
            }, status=status.HTTP_400_BAD_REQUEST)
    except (ValueError, TypeError):
        return Response({
            'error': 'Formato inválido',
            'mensaje': 'El monto debe ser un número válido'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Actualizar reserva
    reserva.saldo_pagado = (reserva.saldo_pagado or Decimal('0')) + monto
    reserva.metodo_pago = metodo_pago
    reserva.fecha_pago = timezone.now()
    reserva.save()
    
    # 💰 REGISTRAR EN CAJA
    try:
        movimiento = registrar_pago_en_caja(
            reserva=reserva,
            monto=monto,
            metodo_pago=metodo_pago,
            tipo_pago='saldo',
            usuario=request.user if request.user.is_authenticated else None
        )
        print(f"✅ Pago de saldo ${monto} registrado en caja (Movimiento #{movimiento.id})")
    except Exception as e:
        print(f"❌ Error al registrar pago en caja: {e}")
        # Revertir el pago si falla el registro
        reserva.saldo_pagado = (reserva.saldo_pagado or Decimal('0')) - monto
        reserva.save()
        return Response({
            'error': 'Error al registrar en caja',
            'mensaje': f'No se pudo registrar el pago en caja: {str(e)}',
            'sugerencia': 'Verifica que la caja esté abierta e intenta nuevamente.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    serializer = ReservaSerializer(reserva)
    return Response({
        'success': True,
        'mensaje': 'Pago registrado exitosamente',
        'reserva': serializer.data,
        'pago_registrado': float(monto),
        'saldo_restante': float(reserva.pendiente),
        'movimiento_id': movimiento.id
    }, status=status.HTTP_200_OK)


# ==========================================
# VERIFICAR CAJA
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def verificar_caja(request):
    """
    GET /api/reservas/verificar_caja/
    Verifica si hay una caja abierta
    """
    turno_activo = obtener_turno_activo()
    
    return Response({
        'caja_abierta': turno_activo is not None,
        'turno_id': turno_activo.id if turno_activo else None,
        'mensaje': 'Caja abierta' if turno_activo else 'Caja cerrada'
    }, status=status.HTTP_200_OK)


# ==========================================
# ACTUALIZAR RESERVA
# ==========================================
@api_view(['GET', 'PATCH', 'PUT'])
@permission_classes([AllowAny])
def actualizar_reserva(request, reserva_id):
    """
    GET /api/reservas/<id>/     → Obtener detalles
    PATCH /api/reservas/<id>/   → Actualizar campos específicos
    PUT /api/reservas/<id>/     → Actualizar todos los campos
    """
    try:
        reserva = Reserva.objects.get(id=reserva_id)
    except Reserva.DoesNotExist:
        return Response({'error': 'Reserva no encontrada'}, status=404)

    if request.method == 'GET':
        serializer = ReservaSerializer(reserva)
        return Response(serializer.data, status=200)

    print(f"📥 Datos recibidos para actualizar: {request.data}")
    
    # Guardar valores anteriores
    saldo_pagado_anterior = reserva.saldo_pagado or Decimal('0')
    
    serializer = ReservaSerializer(
        reserva, 
        data=request.data, 
        partial=(request.method == 'PATCH')
    )
    
    if serializer.is_valid():
        reserva_actualizada = serializer.save()
        
        print(f"✅ Reserva actualizada:")
        print(f"   - Total: {reserva_actualizada.total}")
        print(f"   - Seña: {reserva_actualizada.seña}")
        print(f"   - Saldo pagado: {reserva_actualizada.saldo_pagado}")
        print(f"   - Pendiente: {reserva_actualizada.pendiente}")
        print(f"   - Estado pago: {reserva_actualizada.estado_pago}")
        
        # Calcular diferencia de pago
        saldo_pagado_nuevo = reserva_actualizada.saldo_pagado or Decimal('0')
        diferencia_pago = saldo_pagado_nuevo - saldo_pagado_anterior
        
        # 💰 SI HAY NUEVO PAGO, REGISTRAR EN CAJA
        if diferencia_pago > 0:
            try:
                # Validar que haya caja abierta
                turno_activo = validar_caja_abierta()
                
                metodo_pago = request.data.get('metodo_pago', 'efectivo')
                
                movimiento = registrar_pago_en_caja(
                    reserva=reserva_actualizada,
                    monto=diferencia_pago,
                    metodo_pago=metodo_pago,
                    tipo_pago='saldo',
                    usuario=request.user if request.user.is_authenticated else None
                )
                print(f"✅ Saldo de ${diferencia_pago} registrado en caja (Movimiento #{movimiento.id})")
            except ValidationError as e:
                # Si la caja está cerrada, devolver error
                error_detail = e.detail if hasattr(e, 'detail') else str(e)
                return Response(error_detail, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                print(f"❌ Error al registrar saldo en caja: {e}")
        
        response_serializer = ReservaSerializer(reserva_actualizada)
        return Response({
            'mensaje': 'Reserva actualizada exitosamente',
            'data': response_serializer.data
        }, status=200)
    
    print(f"❌ Errores de validación: {serializer.errors}")
    return Response(serializer.errors, status=400)


# ==========================================
# LISTAR RESERVAS DEL CLIENTE
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def listar_reservas_cliente(request):
    """
    GET /api/reservas/cliente/?estado=...&email=...
    """
    estado = (request.query_params.get('estado') or '').strip().lower()
    email = (request.query_params.get('email') or '').strip().lower()

    if request.user and request.user.is_authenticated and getattr(request.user, 'email', None):
        email = request.user.email.lower()

    if not email:
        return Response({'error': 'Se requiere el parámetro email o sesión autenticada con email'}, status=400)

    qs = Reserva.objects.filter(email_cliente__iexact=email)

    if estado in ['pendiente', 'confirmada', 'rechazada', 'cancelada']:
        qs = qs.filter(estado=estado)
    elif estado == 'proximas':
        ahora = timezone.localtime()
        ids_future = []
        for r in qs.exclude(estado__in=['cancelada', 'rechazada']):
            dt = _dt(r.fecha, r.horario)
            if dt >= ahora:
                ids_future.append(r.id)
        qs = qs.filter(id__in=ids_future)

    qs = qs.order_by('-fecha_creacion')
    serializer = ReservaSerializer(qs, many=True)
    return Response({'count': qs.count(), 'results': serializer.data}, status=200)


# ==========================================
# CONTADORES PARA EL PANEL DEL CLIENTE
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def reservas_cliente_contadores(request):
    """
    GET /api/reservas/cliente/contadores/?email=...
    """
    email = (request.query_params.get('email') or '').strip().lower()
    if request.user and request.user.is_authenticated and getattr(request.user, 'email', None):
        email = request.user.email.lower()

    if not email:
        return Response({'error': 'Se requiere el parámetro email o sesión autenticada con email'}, status=400)

    base = Reserva.objects.filter(email_cliente__iexact=email)
    ahora = timezone.localtime()

    pendientes   = base.filter(estado='pendiente').count()
    confirmadas  = base.filter(estado='confirmada').count()
    rechazadas   = base.filter(estado='rechazada').count()
    canceladas   = base.filter(estado='cancelada').count()

    ids_future = []
    for r in base.exclude(estado__in=['cancelada', 'rechazada']):
        dt = _dt(r.fecha, r.horario)
        if dt >= ahora:
            ids_future.append(r.id)
    proximas = base.filter(id__in=ids_future).count()

    return Response({
        "proximas": proximas,
        "pendientes": pendientes,
        "confirmadas": confirmadas,
        "rechazadas": rechazadas,
        "canceladas": canceladas,
    }, status=200)


# ==========================================
# LISTAR RESERVAS (ADMIN)
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def listar_reservas(request):
    """
    GET /api/reservas/
    Lista todas las reservas con filtros opcionales
    """
    estado = request.query_params.get('estado', None)
    email  = request.query_params.get('email', None)
    qs = Reserva.objects.all()
    if estado:
        qs = qs.filter(estado=estado)
    if email:
        qs = qs.filter(email_cliente__iexact=email)
    qs = qs.order_by('-fecha_creacion')
    serializer = ReservaSerializer(qs, many=True)
    return Response(serializer.data, status=200)
# ==========================================
# CONTINUACIÓN DE reservas/views.py
# ==========================================

# ==========================================
# CONTADORES PARA EL PANEL DEL CLIENTE (CONTINUACIÓN)
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def reservas_cliente_contadores(request):
    """
    GET /api/reservas/cliente/contadores/?email=...
    """
    email = (request.query_params.get('email') or '').strip().lower()
    if request.user and request.user.is_authenticated and getattr(request.user, 'email', None):
        email = request.user.email.lower()

    if not email:
        return Response({'error': 'Se requiere el parámetro email o sesión autenticada con email'}, status=400)

    base = Reserva.objects.filter(email_cliente__iexact=email)
    ahora = timezone.localtime()

    pendientes   = base.filter(estado='pendiente').count()
    confirmadas  = base.filter(estado='confirmada').count()
    rechazadas   = base.filter(estado='rechazada').count()
    canceladas   = base.filter(estado='cancelada').count()

    ids_future = []
    for r in base.exclude(estado__in=['cancelada', 'rechazada']):
        dt = _dt(r.fecha, r.horario)
        if dt >= ahora:
            ids_future.append(r.id)
    proximas = base.filter(id__in=ids_future).count()

    return Response({
        "proximas": proximas,
        "pendientes": pendientes,
        "confirmadas": confirmadas,
        "rechazadas": rechazadas,
        "canceladas": canceladas,
    }, status=200)


# ==========================================
# LISTAR RESERVAS (ADMIN)
# ==========================================
@api_view(['GET'])
@permission_classes([AllowAny])
def listar_reservas(request):
    """
    GET /api/reservas/
    Lista todas las reservas con filtros opcionales
    """
    estado = request.query_params.get('estado', None)
    email  = request.query_params.get('email', None)
    qs = Reserva.objects.all()
    if estado:
        qs = qs.filter(estado=estado)
    if email:
        qs = qs.filter(email_cliente__iexact=email)
    qs = qs.order_by('-fecha_creacion')
    serializer = ReservaSerializer(qs, many=True)
    return Response(serializer.data, status=200) 