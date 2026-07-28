from django.contrib.auth.models import AbstractUser
from django.db import models


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

    def __str__(self):
        return self.nombre
