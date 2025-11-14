from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Reserva  # tu modelo

@receiver(post_save, sender=Reserva)
def reserva_guardada(sender, instance, created, **kwargs):
    if created:
        print(f"Se creó una nueva reserva: {instance}")
