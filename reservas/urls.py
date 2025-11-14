# reservas/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Horarios disponibles
    path('horarios/', views.horarios_disponibles, name='horarios-disponibles'),
    
    # Gestión de reservas
    path('reservas/', views.listar_reservas, name='listar-reservas'),
    path('reservas/crear/', views.crear_reserva, name='crear-reserva'),
    path('reservas/cliente/', views.listar_reservas_cliente, name='reservas-cliente'),
    path('reservas/cliente/contadores/', views.reservas_cliente_contadores, name='reservas-cliente-contadores'),
    path('reservas/verificar_caja/', views.verificar_caja, name='verificar-caja'),
    
    # Operaciones sobre una reserva específica
    path('reservas/<int:reserva_id>/', views.actualizar_reserva, name='actualizar-reserva'),
    path('reservas/<int:reserva_id>/confirmar/', views.confirmar_reserva, name='confirmar-reserva'),
    path('reservas/<int:reserva_id>/rechazar/', views.rechazar_reserva, name='rechazar-reserva'),
    path('reservas/<int:reserva_id>/pagar_saldo/', views.pagar_saldo, name='pagar-saldo'),
] 