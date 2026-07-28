from django.db import models

from .context import get_current_tenant_id


class TenantManager(models.Manager):
    """Filtra siempre por el tenant actual (ver tenancy.context).

    Sin tenant en contexto, devuelve un queryset vacío: mejor fallar
    "no hay datos" que arriesgar una fuga entre tenants.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = get_current_tenant_id()
        if tenant_id is None:
            return qs.none()
        return qs.filter(tenant_id=tenant_id)
