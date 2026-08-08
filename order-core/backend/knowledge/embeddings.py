import os

import requests

from .models import EMBEDDING_DIMENSIONS

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
VOYAGE_MODEL = "voyage-4"


def embed(texts: list[str], input_type: str) -> list[list[float]]:
    """Pide embeddings a Voyage AI (tarea 39, RAG Engine).

    `input_type` distingue "document" (indexar contenido, admin) de
    "query" (buscar, KnowledgeSearchView) -- Voyage codifica cada uno
    distinto internamente para mejorar la calidad del retrieval.
    """
    response = requests.post(
        VOYAGE_API_URL,
        headers={"Authorization": f"Bearer {os.environ['VOYAGE_API_KEY']}"},
        json={
            "input": texts,
            "model": VOYAGE_MODEL,
            "input_type": input_type,
            "output_dimension": EMBEDDING_DIMENSIONS,
        },
        timeout=10,
    )
    response.raise_for_status()
    return response.json()["embeddings"]
