from drf_spectacular.utils import extend_schema
from pgvector.django import CosineDistance
from rest_framework.response import Response
from rest_framework.views import APIView

from tenants.authentication import BotTokenAuthentication

from .embeddings import embed
from .models import KnowledgeChunk
from .serializers import KnowledgeChunkResultSerializer


class KnowledgeSearchView(APIView):
    """Tool `consultar_base_de_conocimiento` del bot (spec de la capa de
    IA, tarea 39, RAG Engine): busca en el contenido estático cargado
    por el admin y devuelve los fragmentos más parecidos a la pregunta.
    """

    authentication_classes = [BotTokenAuthentication]

    @extend_schema(responses=KnowledgeChunkResultSerializer(many=True))
    def get(self, request):
        query = request.query_params.get("query", "").strip()
        if not query:
            return Response({"detail": "Falta el parámetro query."}, status=400)

        [query_vector] = embed([query], input_type="query")
        chunks = (
            KnowledgeChunk.objects.exclude(embedding__isnull=True)
            .annotate(distance=CosineDistance("embedding", query_vector))
            .order_by("distance")[:3]
        )
        return Response(KnowledgeChunkResultSerializer(chunks, many=True).data)
