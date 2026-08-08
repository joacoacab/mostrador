from django.contrib import admin

from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ["role", "content", "created_at"]
    can_delete = False


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["id", "tenant", "customer_phone", "estado", "last_message_at"]
    list_filter = ["estado"]
    readonly_fields = ["resumen", "resumido_hasta_id", "last_message_at", "created_at"]
    inlines = [MessageInline]
