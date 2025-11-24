# barbers/views.py
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Barber
from .serializers import BarberSerializer

class BarberViewSet(viewsets.ModelViewSet):
    """
    CRUD completo con soft delete, restore y creación automática de usuario.
    """
    queryset = Barber.objects.all()
    serializer_class = BarberSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Crea un barbero Y su usuario asociado automáticamente.
        
        Recibe (multipart/form-data):
        - name: Nombre del barbero
        - specialty: Especialidad
        - work_schedule: Horario
        - photo: Foto (opcional)
        - email: Email del usuario (REQUERIDO)
        - username: Username (opcional, se genera del nombre si no viene)
        - password: Contraseña (opcional, se genera si no viene)
        """
        try:
            # Obtener datos del barbero
            name = request.data.get('name')
            specialty = request.data.get('specialty', '')
            work_schedule = request.data.get('work_schedule', '')
            photo = request.FILES.get('photo')
            
            # Obtener datos del usuario
            email = request.data.get('email')
            username = request.data.get('username')
            password = request.data.get('password')
            
            # Validaciones
            if not name:
                return Response(
                    {'error': 'El nombre es requerido'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not email:
                return Response(
                    {'error': 'El email es requerido para crear el usuario'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Verificar que el email no exista
            if User.objects.filter(email=email).exists():
                return Response(
                    {'error': 'Ya existe un usuario con ese email'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generar username si no viene
            if not username:
                # Formato: nombre_apellido o nombre123
                base_username = name.lower().replace(' ', '_')
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1
            
            # Generar contraseña si no viene
            if not password:
                import random
                import string
                password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
            
            # 1️⃣ Crear el usuario
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=name.split()[0] if name else '',
                last_name=' '.join(name.split()[1:]) if len(name.split()) > 1 else ''
            )
            
            # 2️⃣ Asignar rol "barbero" en el perfil
            if hasattr(user, 'profile'):
                user.profile.role = 'barbero'
                user.profile.save()
            else:
                from usuarios.models import UserProfile
                UserProfile.objects.create(user=user, role='barbero')
            
            # 3️⃣ Crear el perfil de barbero
            barber = Barber.objects.create(
                user=user,
                name=name,
                specialty=specialty,
                work_schedule=work_schedule,
                photo=photo
            )
            
            serializer = self.get_serializer(barber)
            
            return Response({
                'message': 'Barbero creado exitosamente',
                'barber': serializer.data,
                'user_created': {
                    'username': username,
                    'email': email,
                    'password': password,  # ⚠️ Solo para desarrollo, no enviar en producción
                    'user_id': user.id
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error al crear barbero: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        """Actualiza un barbero (sin modificar el usuario)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        """Eliminar (soft delete) - NO elimina el usuario"""
        barber = self.get_object()
        barber.soft_delete()
        
        # ✅ También degradar el usuario a 'cliente' automáticamente
        if barber.user and hasattr(barber.user, 'profile'):
            barber.user.profile.role = 'cliente'
            barber.user.profile.save()
        
        return Response(
            {'message': 'Barbero desactivado y degradado a cliente'},
            status=status.HTTP_204_NO_CONTENT
        )

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        """
        Restaurar un barbero eliminado
        ✅ También restaura el rol 'barbero' en el usuario
        """
        try:
            barber = Barber.all_objects.get(pk=pk)
            barber.restore()
            
            # ✅ Restaurar rol de barbero
            if barber.user and hasattr(barber.user, 'profile'):
                barber.user.profile.role = 'barbero'
                barber.user.profile.activo = True
                barber.user.profile.save()
            
            serializer = self.get_serializer(barber)
            return Response({
                'message': 'Barbero restaurado y rol actualizado',
                'barber': serializer.data
            }, status=status.HTTP_200_OK)
        except Barber.DoesNotExist:
            return Response(
                {"error": "Barbero no encontrado"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        """
        ✅ NUEVO: Listar solo barberos eliminados
        GET /api/barbers/eliminados/
        """
        queryset = Barber.all_objects.filter(is_deleted=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="all")
    def all(self, request):
        """Listar todos (incluyendo eliminados si se pasa ?include_deleted=true)"""
        include_deleted = request.query_params.get("include_deleted") == "true"
        queryset = Barber.all_objects.all() if include_deleted else Barber.objects.all()
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        return self.get_paginated_response(serializer.data) if page else Response(serializer.data)