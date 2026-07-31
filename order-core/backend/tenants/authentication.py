from rest_framework import authentication, exceptions

from tenancy.context import set_current_tenant_id

from .models import BotToken, PairingCode


class AnonymousDeviceUser:
    """Stand-in de request.user para una pantalla pareada (tarea 21).

    No es un User de Django -- una pantalla no es un empleado, es un
    dispositivo. Solo necesita is_authenticated=True para que
    IsAuthenticated la deje pasar; DenyDeviceWrites (tenants/
    permissions.py) usa el tipo para bloquear escrituras.
    """

    is_authenticated = True

    def __init__(self, tenant_id):
        self.id = None
        self.tenant_id = tenant_id


class DeviceTokenAuthentication(authentication.BaseAuthentication):
    """Header `Authorization: DeviceToken <token>`.

    Esquema distinto de "Bearer" (JWT) a propósito: si usara Bearer
    también, JWTAuthentication probaría decodificar el device_token
    como JWT, fallaría, y DRF cortaría ahí sin probar esta clase --
    una excepción de un authenticator no sigue a la próxima, a
    diferencia de un return None.
    """

    keyword = "DeviceToken"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].decode().lower() != self.keyword.lower():
            return None
        if len(header) != 2:
            raise exceptions.AuthenticationFailed("Header DeviceToken inválido.")

        token = header[1].decode()
        try:
            pairing = PairingCode.objects.get(device_token=token, claimed_at__isnull=False)
        except PairingCode.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Token de dispositivo inválido.") from exc

        set_current_tenant_id(pairing.tenant_id)
        return (AnonymousDeviceUser(pairing.tenant_id), None)


class AnonymousBotUser:
    """Stand-in de request.user para el whatsapp-agent (tarea 25).

    A diferencia de AnonymousDeviceUser, expone `.tenant` (el objeto,
    no solo el id): el bot necesita crear pedidos
    (OrderViewSet.perform_create hace request.user.tenant), la
    pantalla solo lee.
    """

    is_authenticated = True

    def __init__(self, tenant):
        self.id = None
        self.tenant = tenant
        self.tenant_id = tenant.id


class BotTokenAuthentication(authentication.BaseAuthentication):
    """Header `Authorization: BotToken <token>`. Mismo motivo que
    DeviceTokenAuthentication para no usar el esquema "Bearer"."""

    keyword = "BotToken"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).split()
        if not header or header[0].decode().lower() != self.keyword.lower():
            return None
        if len(header) != 2:
            raise exceptions.AuthenticationFailed("Header BotToken inválido.")

        token = header[1].decode()
        try:
            bot_token = BotToken.objects.select_related("tenant").get(token=token, active=True)
        except BotToken.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Token de bot inválido.") from exc

        set_current_tenant_id(bot_token.tenant_id)
        return (AnonymousBotUser(bot_token.tenant), None)
