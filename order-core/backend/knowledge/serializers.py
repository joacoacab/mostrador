from rest_framework import serializers

from .models import KnowledgeChunk


class KnowledgeChunkResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeChunk
        fields = ["id", "contenido"]
