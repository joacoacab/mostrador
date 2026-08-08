from django.contrib import admin

from .embeddings import embed
from .models import KnowledgeChunk


@admin.register(KnowledgeChunk)
class KnowledgeChunkAdmin(admin.ModelAdmin):
    list_display = ["id", "tenant", "contenido_corto", "created_at"]
    fields = ["tenant", "contenido"]

    @admin.display(description="Contenido")
    def contenido_corto(self, obj):
        return obj.contenido[:80]

    def save_model(self, request, obj, form, change):
        # Acá y no en Model.save() (tarea 39): "carga manual por admin,
        # sin panel todavía" -- el embedding solo hace falta cuando se
        # carga contenido real, no en cada save() de un test.
        [vector] = embed([obj.contenido], input_type="document")
        obj.embedding = vector
        super().save_model(request, obj, form, change)
