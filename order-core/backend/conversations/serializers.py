from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["id", "role", "content", "created_at"]
        read_only_fields = ["id", "created_at"]


class ConversationSerializer(serializers.ModelSerializer):
    """Vista del bot (mine): trae el resumen y solo los mensajes sin
    resumir todavía -- no el historial completo (spec de la tarea 40)."""

    mensajes = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ["id", "estado", "resumen", "mensajes"]

    @extend_schema_field(MessageSerializer(many=True))
    def get_mensajes(self, conversation):
        pending = conversation.messages.all()
        if conversation.resumido_hasta_id is not None:
            pending = pending.filter(id__gt=conversation.resumido_hasta_id)
        return MessageSerializer(pending, many=True).data


class ConversationStaffSerializer(serializers.ModelSerializer):
    """Vista de staff (panel/consulta, tarea 40): estado + metadata,
    sin el detalle de mensajes -- eso es un endpoint aparte si hace
    falta más adelante (panel real, tarea 41 en más profundidad)."""

    class Meta:
        model = Conversation
        fields = ["id", "customer_phone", "estado", "resumen", "last_message_at", "created_at"]


class AppendMessageSerializer(serializers.Serializer):
    customer_phone = serializers.CharField()
    role = serializers.ChoiceField(choices=Message.ROLE_CHOICES)
    content = serializers.CharField()


class UpdateSummarySerializer(serializers.Serializer):
    customer_phone = serializers.CharField()
    resumen = serializers.CharField()
    resumido_hasta = serializers.IntegerField()
