from django.apps import AppConfig


class TenantsConfig(AppConfig):
    name = 'tenants'

    def ready(self):
        # Registra la OpenApiAuthenticationExtension de schema.py --
        # ver accounts/apps.py para la misma explicación.
        from . import schema  # noqa: F401
