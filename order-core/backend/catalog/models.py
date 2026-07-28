from django.db import models

from tenancy.models import TenantScopedModel


class Product(TenantScopedModel):
    ORIGEN_MANUAL = "manual"
    ORIGEN_INTEGRACION = "integracion"
    ORIGEN_CHOICES = [
        (ORIGEN_MANUAL, "Manual"),
        (ORIGEN_INTEGRACION, "Integración"),
    ]

    nombre = models.CharField(max_length=200)
    precio = models.DecimalField(max_digits=10, decimal_places=2)
    unidad = models.CharField(max_length=50)
    disponible = models.BooleanField(default=True)
    origen = models.CharField(max_length=20, choices=ORIGEN_CHOICES, default=ORIGEN_MANUAL)
    external_id = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return self.nombre
