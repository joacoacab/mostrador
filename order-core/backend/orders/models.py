from django.db import models

from tenancy.models import TenantScopedModel


class Customer(TenantScopedModel):
    telefono = models.CharField(max_length=32)
    nombre = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "telefono"], name="unique_telefono_por_tenant"
            )
        ]

    def __str__(self):
        return self.nombre
