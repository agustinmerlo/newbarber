from rest_framework import serializers
from .models import Servicio

class ServicioSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo Servicio con manejo flexible de duración
    """
    # Campo personalizado para aceptar tanto "45 min" como "45"
    duracion_display = serializers.SerializerMethodField()
    
    class Meta:
        model = Servicio
        fields = [
            'id',
            'nombre',
            'descripcion',
            'precio',
            'duracion',
            'duracion_display',  # Campo adicional para el frontend
            'imagen',  # ← AGREGADO
            'activo',
            'creado_en',
            'actualizado_en'
        ]
        read_only_fields = ['id', 'creado_en', 'actualizado_en']
    
    def get_duracion_display(self, obj):
        """
        Devuelve la duración en formato legible: '45 min'
        """
        return f"{obj.duracion} min"
    
    def validate_duracion(self, value):
        """
        Valida y convierte la duración a entero si viene como string
        """
        if isinstance(value, str):
            # Extraer números del string "45 min" -> 45
            import re
            numeros = re.findall(r'\d+', value)
            if numeros:
                value = int(numeros[0])
            else:
                raise serializers.ValidationError("Formato de duración inválido")
        
        if value <= 0:
            raise serializers.ValidationError("La duración debe ser mayor a 0")
        
        return value
    
    def to_representation(self, instance):
        """
        Personaliza la respuesta para que el frontend vea 'duracion' como string
        y la imagen como URL completa
        """
        data = super().to_representation(instance)
        
        # Convertir duracion a formato "X min" para compatibilidad con React
        data['duracion'] = f"{instance.duracion} min"
        
        # Convertir imagen a URL completa si existe
        if instance.imagen:
            request = self.context.get('request')
            if request is not None:
                data['imagen'] = request.build_absolute_uri(instance.imagen.url)
            else:
                data['imagen'] = instance.imagen.url
        else:
            data['imagen'] = None
        
        return data