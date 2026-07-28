from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models

from tenancy.managers import TenantManager


class ScopedUserManager(TenantManager, UserManager):
    """UserManager con lectura scopeada por tenant.

    create_user/create_superuser no quedan afectados (son altas, no
    pasan por get_queryset), así que siguen funcionando igual que el
    UserManager de Django. Lo que cambia es que las lecturas
    (User.objects.get/filter/all) sólo ven el tenant actual.
    """


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

    # objects (el manager que se usa por reflejo) queda scopeado por
    # tenant: seguro por default. unscoped_for_auth es la única
    # excepción explícita, reservada al flujo de login (accounts/
    # backends.py) y a la resolución del JWT (accounts/
    # authentication.py), que necesitan encontrar al usuario ANTES de
    # saber su tenant.
    objects = ScopedUserManager()
    unscoped_for_auth = UserManager()

    class Meta:
        default_manager_name = "objects"

    def __str__(self):
        return self.nombre
