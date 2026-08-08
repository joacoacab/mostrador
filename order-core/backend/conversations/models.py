from django.db import models

from tenancy.models import TenantScopedModel


class Conversation(TenantScopedModel):
    """Memoria de una conversación de WhatsApp (spec de la capa de IA,
    tarea 40) -- reemplaza a la memoria en Redis de la tarea 34.

    `resumen` + `resumido_hasta_id`: en vez de reenviar toda la
    conversación en cada turno, whatsapp-agent manda solo el resumen
    corriente más los mensajes con id > resumido_hasta_id (los que
    todavía no se plegaron al resumen). `resumido_hasta_id` es un
    entero simple, no FK a Message, para no crear una referencia
    circular entre los dos modelos -- es solo un cursor.

    `estado`: por ahora solo lo usa de verdad la tarea 41
    (escalamiento -> requiere_atencion). "esperando_confirmacion" no
    se detecta automático en esta tarea -- no hay una señal confiable
    y grounded en una tool para eso, y no vale la pena una heurística
    de texto (mismo tipo de problema que la alucinación de la tarea
    36). El campo existe y es consultable, que es el criterio de esta
    tarea; queda preparado para una detección real más adelante.
    """

    ESTADO_ACTIVA = "activa"
    ESTADO_REQUIERE_ATENCION = "requiere_atencion"
    ESTADO_CHOICES = [
        (ESTADO_ACTIVA, "Activa"),
        (ESTADO_REQUIERE_ATENCION, "Requiere atención"),
    ]

    customer_phone = models.CharField(max_length=50)
    estado = models.CharField(max_length=30, choices=ESTADO_CHOICES, default=ESTADO_ACTIVA)
    resumen = models.TextField(blank=True, default="")
    resumido_hasta_id = models.BigIntegerField(null=True, blank=True)
    last_message_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tenant", "customer_phone"], name="unique_conversation_por_telefono")
        ]

    def __str__(self):
        return f"Conversación con {self.customer_phone} ({self.estado})"


class Message(models.Model):
    ROLE_USER = "user"
    ROLE_ASSISTANT = "assistant"
    ROLE_CHOICES = [
        (ROLE_USER, "user"),
        (ROLE_ASSISTANT, "assistant"),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"
