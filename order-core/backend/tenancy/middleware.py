from .context import clear_current_tenant_id, set_current_tenant_id


class TenantMiddleware:
    """Fija el tenant actual a partir del usuario autenticado del request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        tenant_id = user.tenant_id if user is not None and user.is_authenticated else None
        set_current_tenant_id(tenant_id)
        try:
            return self.get_response(request)
        finally:
            clear_current_tenant_id()
