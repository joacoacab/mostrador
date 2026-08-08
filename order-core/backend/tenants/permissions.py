from rest_framework.permissions import SAFE_METHODS, BasePermission

from .authentication import AnonymousBotUser, AnonymousDeviceUser


class DenyDeviceWrites(BasePermission):
    """La pantalla (tarea 21) es solo lectura (spec sección 3.5).

    Permite GET/HEAD/OPTIONS a cualquier request autenticado (staff o
    dispositivo); para métodos de escritura, exige que quien pide NO
    sea un dispositivo pareado.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return not isinstance(request.user, AnonymousDeviceUser)


class DenyBotStatusChanges(BasePermission):
    """El bot (tarea 25) puede leer catálogo/pedidos y crear pedidos,
    pero cambiar el estado libremente (`status_transition`) no está
    entre sus tools (spec 4.1) -- eso lo hace un humano desde el panel.
    Chequea por `action`, no por método: a diferencia de la pantalla,
    el bot SÍ puede hacer POST (crear pedido), así que un chequeo
    genérico de "solo lectura" no sirve acá.

    La única excepción a propósito es `cancel` (tarea 36): una
    transición de estado bien acotada (siempre a cancelado, con el
    chequeo de que el pedido es del que escribe) que sí es una tool
    del bot -- por eso no está en la lista de acciones bloqueadas acá,
    esa vista valida la pertenencia por su cuenta.
    """

    def has_permission(self, request, view):
        if getattr(view, "action", None) != "status_transition":
            return True
        return not isinstance(request.user, AnonymousBotUser)
