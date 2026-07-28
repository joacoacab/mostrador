from django.contrib.auth.models import AbstractUser
from django.db import models

from tenancy.managers import TenantManager


class User(AbstractUser):
    ROL_ADMIN = "admin"
    ROL_EMPLEADO = "empleado"
    ROL_CHOICES = [
        (ROL_ADMIN, "Admin"),
        (ROL_EMPLEADO, "Empleado"),
    ]

    tenant = models.ForeignKey(
        "tenants.Tenant", on_delete=models.CASCADE, related_name="users"
    )
    rol = models.CharField(max_length=20, choices=ROL_CHOICES)
    nombre = models.CharField(max_length=200)

    # `objects` (heredado de AbstractUser) queda sin scopear a propósito:
    # Django lo necesita para resolver el login antes de saber el tenant
    # del usuario. `tenant_scoped` es el manager a usar en el resto del
    # código de negocio, una vez que ya se conoce el tenant del request.
    tenant_scoped = TenantManager()

    def __str__(self):
        return self.nombre
