from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsAdminRole


class MeView(APIView):
    """Devuelve el usuario autenticado. Sirve para que el frontend
    sepa quién está logueado, y como endpoint protegido de referencia
    para probar que el auth JWT funciona (tarea 8)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                "id": user.id,
                "username": user.username,
                "nombre": user.nombre,
                "rol": user.rol,
                "tenant": user.tenant_id,
            }
        )


class AdminOnlyPingView(APIView):
    """Endpoint de prueba para el permiso IsAdminRole (tarea 8)."""

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response({"ok": True})
