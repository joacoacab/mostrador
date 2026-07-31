from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PairingCode
from .serializers import (
    PairingClaimResultSerializer,
    PairingClaimSerializer,
    PairingCodeSerializer,
    TenantInfoSerializer,
)


class TenantInfoView(APIView):
    """Horarios/ubicación/medios de pago del tenant (tarea 24) --
    fuente de la tool de FAQ del bot (spec 4.1). Por ahora solo la
    puede pedir un staff logueado (auth default); la tarea 25 le
    suma la auth de bot."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=TenantInfoSerializer)
    def get(self, request):
        return Response(TenantInfoSerializer(request.user.tenant).data)


class PairingGenerateView(APIView):
    """Genera un código de 6 dígitos para parear una pantalla (tarea
    21). Lo llama un operador logueado desde el panel."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses=PairingCodeSerializer)
    def post(self, request):
        pairing = PairingCode.objects.create(tenant=request.user.tenant)
        return Response(PairingCodeSerializer(pairing).data, status=status.HTTP_201_CREATED)


class PairingClaimView(APIView):
    """Canjea un código por un device_token. Sin auth: la pantalla
    todavía no tiene ninguna credencial en este punto -- el código en
    sí es la credencial temporal."""

    permission_classes = [AllowAny]

    @extend_schema(request=PairingClaimSerializer, responses=PairingClaimResultSerializer)
    def post(self, request):
        serializer = PairingClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]

        pairing = (
            PairingCode.objects.filter(code=code, claimed_at__isnull=True, expires_at__gt=timezone.now())
            .order_by("-created_at")
            .first()
        )
        if pairing is None:
            return Response({"detail": "Código inválido o vencido."}, status=status.HTTP_400_BAD_REQUEST)

        pairing.claimed_at = timezone.now()
        pairing.save(update_fields=["claimed_at"])

        return Response(
            PairingClaimResultSerializer(
                {"device_token": pairing.device_token, "tenant_nombre": pairing.tenant.nombre}
            ).data
        )
