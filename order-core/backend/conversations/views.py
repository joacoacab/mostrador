from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.authentication import BotTokenAuthentication

from .models import Conversation, Message
from .serializers import (
    AppendMessageSerializer,
    ConversationSerializer,
    ConversationStaffSerializer,
    UpdateSummarySerializer,
)


def _get_or_create_conversation(tenant, customer_phone):
    conversation, _ = Conversation.objects.get_or_create(tenant=tenant, customer_phone=customer_phone)
    return conversation


class MyConversationView(APIView):
    """Memoria del bot (tarea 40): GET trae resumen + mensajes sin
    resumir, PATCH actualiza el resumen corriente después de plegar
    mensajes viejos (lo hace whatsapp-agent, no este view)."""

    authentication_classes = [BotTokenAuthentication]

    @extend_schema(responses=ConversationSerializer)
    def get(self, request):
        customer_phone = request.query_params.get("customer_phone", "").strip()
        if not customer_phone:
            return Response({"detail": "Falta el parámetro customer_phone."}, status=400)
        conversation = _get_or_create_conversation(request.user.tenant, customer_phone)
        return Response(ConversationSerializer(conversation).data)

    @extend_schema(request=UpdateSummarySerializer, responses=ConversationSerializer)
    def patch(self, request):
        serializer = UpdateSummarySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conversation = _get_or_create_conversation(request.user.tenant, data["customer_phone"])
        conversation.resumen = data["resumen"]
        conversation.resumido_hasta_id = data["resumido_hasta"]
        conversation.save(update_fields=["resumen", "resumido_hasta_id"])
        return Response(ConversationSerializer(conversation).data)


class ConversationMessagesView(APIView):
    """Agrega un mensaje (usuario o bot) a la conversación de ese
    teléfono -- crea la conversación si es el primer mensaje."""

    authentication_classes = [BotTokenAuthentication]

    @extend_schema(request=AppendMessageSerializer, responses=ConversationSerializer)
    def post(self, request):
        serializer = AppendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conversation = _get_or_create_conversation(request.user.tenant, data["customer_phone"])
        Message.objects.create(conversation=conversation, role=data["role"], content=data["content"])
        conversation.save(update_fields=["last_message_at"])  # auto_now, solo dispara el update
        return Response(ConversationSerializer(conversation).data, status=201)


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta de staff (tarea 40, "el estado se puede consultar en
    el Order Core") -- listado/detalle, sin editar desde acá."""

    serializer_class = ConversationStaffSerializer

    def get_queryset(self):
        # Method, no atributo de clase: mismo motivo que ProductViewSet
        # (catalog/views.py) -- Conversation.objects depende del tenant
        # en contexto al momento del request.
        return Conversation.objects.all()
