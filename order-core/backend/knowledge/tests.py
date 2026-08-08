from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from tenants.models import BotToken, Tenant

from .models import KnowledgeChunk


def vector(peak_index: int) -> list[float]:
    """Vector de 1024 dims con un 1.0 en `peak_index` y 0 en el resto --
    alcanza para que CosineDistance ordene de forma predecible en los tests
    sin necesitar embeddings reales de Voyage."""
    v = [0.0] * 1024
    v[peak_index] = 1.0
    return v


class KnowledgeSearchViewTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-knowledge", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-knowledge", plan="basico")
        self.bot_token = BotToken.objects.create(tenant=self.tenant_a)

        self.chunk_cercano = KnowledgeChunk.all_objects.create(
            tenant=self.tenant_a, contenido="Política de cambios: 10 días con ticket.", embedding=vector(0)
        )
        self.chunk_lejano = KnowledgeChunk.all_objects.create(
            tenant=self.tenant_a, contenido="Hacemos envíos a todo el país.", embedding=vector(500)
        )
        self.chunk_sin_embedding = KnowledgeChunk.all_objects.create(
            tenant=self.tenant_a, contenido="Cargado pero sin procesar todavía.", embedding=None
        )
        self.chunk_otro_tenant = KnowledgeChunk.all_objects.create(
            tenant=self.tenant_b, contenido="Política de otro comercio.", embedding=vector(0)
        )

        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"BotToken {self.bot_token.token}")

    def test_requiere_bot_token(self):
        client = APIClient()
        response = client.get("/api/knowledge/search/?query=cambios")
        self.assertEqual(response.status_code, 403)

    def test_requiere_query(self):
        response = self.client.get("/api/knowledge/search/")
        self.assertEqual(response.status_code, 400)

    @patch("knowledge.views.embed")
    def test_devuelve_los_mas_parecidos_por_distancia_coseno(self, mock_embed):
        mock_embed.return_value = [vector(0)]  # la query "queda" pegada al chunk_cercano

        response = self.client.get("/api/knowledge/search/?query=cual es la politica de cambios")

        self.assertEqual(response.status_code, 200)
        contenidos = [c["contenido"] for c in response.json()]
        self.assertEqual(contenidos[0], self.chunk_cercano.contenido)
        mock_embed.assert_called_once_with(["cual es la politica de cambios"], input_type="query")

    @patch("knowledge.views.embed")
    def test_no_incluye_chunks_sin_embedding_ni_de_otro_tenant(self, mock_embed):
        mock_embed.return_value = [vector(0)]

        response = self.client.get("/api/knowledge/search/?query=algo")

        contenidos = [c["contenido"] for c in response.json()]
        self.assertNotIn(self.chunk_sin_embedding.contenido, contenidos)
        self.assertNotIn(self.chunk_otro_tenant.contenido, contenidos)


class KnowledgeChunkAdminTests(TestCase):
    @patch("knowledge.admin.embed")
    def test_save_model_genera_y_guarda_el_embedding(self, mock_embed):
        from django.contrib.admin.sites import AdminSite

        from .admin import KnowledgeChunkAdmin

        mock_embed.return_value = [vector(3)]
        tenant = Tenant.objects.create(nombre="Tenant Admin", slug="tenant-admin-knowledge", plan="basico")
        chunk = KnowledgeChunk(tenant=tenant, contenido="Aceptamos devoluciones con ticket.")

        KnowledgeChunkAdmin(KnowledgeChunk, AdminSite()).save_model(request=None, obj=chunk, form=None, change=False)

        mock_embed.assert_called_once_with(["Aceptamos devoluciones con ticket."], input_type="document")
        saved = KnowledgeChunk.all_objects.get(pk=chunk.pk)
        self.assertEqual(list(saved.embedding), vector(3))
