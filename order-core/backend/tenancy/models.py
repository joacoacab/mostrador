from django.db import models

from .managers import TenantManager


class TenantScopedModel(models.Model):
    """Base para modelos con datos propios de un tenant.

    `objects` ya viene scopeado por TenantManager; `all_objects` es la
    vía de escape explícita para el puñado de casos que necesitan ver
    todos los tenants (ej. tareas administrativas).
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE)

    objects = TenantManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True
