from django.db import models

class Servicio(models.Model):
    """
    Modelo para representar los servicios de la barbería
    (corte de cabello, barba, coloración, etc.)
    """
    nombre = models.CharField(max_length=100, verbose_name="Nombre del Servicio")
    descripcion = models.TextField(blank=True, null=True, verbose_name="Descripción")
    precio = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Precio")
    duracion = models.IntegerField(help_text="Duración en minutos", verbose_name="Duración")
    imagen = models.ImageField(
        upload_to='servicios/', 
        blank=True, 
        null=True, 
        verbose_name="Imagen del Servicio",
        help_text="Imagen representativa del servicio"
    )
    activo = models.BooleanField(default=True, verbose_name="Servicio Activo")
    creado_en = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de Creación")
    actualizado_en = models.DateTimeField(auto_now=True, verbose_name="Última Actualización")

    class Meta:
        verbose_name = "Servicio"
        verbose_name_plural = "Servicios"
        ordering = ['nombre']

    def __str__(self):
        return f"{self.nombre} - ${self.precio}"