from django.db import models
from pgvector.django import VectorField

from tenancy.models import TenantScopedModel

# voyage-4 (ver knowledge/embeddings.py) con output_dimension fijo -- si
# cambia el modelo o la dimensión hay que migrar esta columna.
EMBEDDING_DIMENSIONS = 1024


class KnowledgeChunk(TenantScopedModel):
    """Contenido estático del comercio para RAG (spec de la capa de IA,
    tarea 39): políticas, FAQ largo -- lo que no entra en los campos
    cortos de Tenant (horarios/ubicación/medios de pago, tarea 24).

    `embedding` nullable: se completa en KnowledgeChunkAdmin.save_model
    (no en este save()) para no pegarle a la API de Voyage en cada
    fixture de test. Un chunk sin embedding no aparece en las búsquedas
    (KnowledgeSearchView lo excluye).
    """

    contenido = models.TextField()
    embedding = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.contenido[:60]
