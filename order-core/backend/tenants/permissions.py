from rest_framework.permissions import SAFE_METHODS, BasePermission

from .authentication import AnonymousDeviceUser


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
