from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.authentication import BotTokenAuthentication

from .models import Conversation, Message
from .serializers import (
    AppendMessageSerializer,
    ConversationSerializer,
    ConversationStaffSerializer,
    EscalateSerializer,
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


class ConversationEscalateView(APIView):
    """Tool `escalar_a_humano` del bot (spec de la capa de IA, tarea 41):
    marca la conversación como `requiere_atencion` con un resumen corto
    (lo escribe el modelo como argumento de la tool, no un llamado
    aparte -- ya tiene todo el contexto en la ventana de la conversación,
    no hace falta gastar otro llamado a Claude solo para resumir esto).

    Pliega TODOS los mensajes al resumen (a diferencia del resumen
    corriente de la tarea 40, que deja los últimos verbatim): una vez
    escalada, la sigue un humano desde el panel, no hace falta que el
    bot guarde mensajes recientes sueltos para su propio contexto.
    """

    authentication_classes = [BotTokenAuthentication]

    @extend_schema(request=EscalateSerializer, responses=ConversationSerializer)
    def post(self, request):
        serializer = EscalateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        conversation = _get_or_create_conversation(request.user.tenant, data["customer_phone"])
        last_message = conversation.messages.last()
        conversation.estado = Conversation.ESTADO_REQUIERE_ATENCION
        conversation.resumen = data["resumen"]
        conversation.resumido_hasta_id = last_message.id if last_message else None
        conversation.save(update_fields=["estado", "resumen", "resumido_hasta_id"])
        return Response(ConversationSerializer(conversation).data)


class ConversationViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta de staff (tarea 40, "el estado se puede consultar en
    el Order Core") -- listado/detalle de solo lectura, más la acción
    puntual de `resolver` (tarea 41) para sacar una conversación
    escalada de la lista una vez que un humano ya la atendió."""

    serializer_class = ConversationStaffSerializer

    def get_queryset(self):
        # Method, no atributo de clase: mismo motivo que ProductViewSet
        # (catalog/views.py) -- Conversation.objects depende del tenant
        # en contexto al momento del request.
        queryset = Conversation.objects.all().order_by("-last_message_at")
        estado = self.request.query_params.get("estado")
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset

    @action(detail=True, methods=["post"], url_path="resolver")
    def resolver(self, request, pk=None):
        conversation = self.get_object()
        conversation.estado = Conversation.ESTADO_ACTIVA
        conversation.save(update_fields=["estado"])
        return Response(ConversationStaffSerializer(conversation).data)
