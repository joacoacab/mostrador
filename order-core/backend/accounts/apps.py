from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        # Registra la OpenApiAuthenticationExtension de schema.py --
        # drf-spectacular la descubre por definición de clase, pero
        # necesita que el módulo se importe en algún momento.
        from . import schema  # noqa: F401
