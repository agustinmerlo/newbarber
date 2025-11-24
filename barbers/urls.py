# barbers/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BarberViewSet

router = DefaultRouter()
router.register(r'', BarberViewSet, basename='barber')

urlpatterns = [
    path('', include(router.urls)),
]

# Endpoints disponibles:
# GET    /api/barbers/              - Lista barberos activos
# POST   /api/barbers/              - Crear barbero + usuario
# GET    /api/barbers/{id}/         - Detalle de barbero
# PUT    /api/barbers/{id}/         - Actualizar barbero
# DELETE /api/barbers/{id}/         - Soft delete (degradar a cliente)
# POST   /api/barbers/{id}/restore/ - Restaurar barbero (promocionar a barbero)
# GET    /api/barbers/eliminados/   - Lista barberos eliminados ✅ NUEVO
# GET    /api/barbers/all/          - Lista todos (con ?include_deleted=true) 