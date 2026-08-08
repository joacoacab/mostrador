from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.testing import authenticate_as
from tenants.models import BotToken, Tenant

from .models import Conversation, Message


class MyConversationViewTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-conv", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-conv", plan="basico")
        self.bot_token = BotToken.objects.create(tenant=self.tenant_a)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"BotToken {self.bot_token.token}")

    def test_get_crea_la_conversacion_si_no_existe(self):
        response = self.client.get("/api/conversations/mine/?customer_phone=%2B5491111111")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], Conversation.ESTADO_ACTIVA)
        self.assertEqual(response.json()["mensajes"], [])
        self.assertEqual(Conversation.all_objects.filter(tenant=self.tenant_a, customer_phone="+5491111111").count(), 1)

    def test_get_sin_customer_phone_da_400(self):
        response = self.client.get("/api/conversations/mine/")
        self.assertEqual(response.status_code, 400)

    def test_post_messages_agrega_y_get_lo_devuelve(self):
        self.client.post(
            "/api/conversations/mine/messages/",
            {"customer_phone": "+5491111111", "role": "user", "content": "hola"},
            format="json",
        )
        self.client.post(
            "/api/conversations/mine/messages/",
            {"customer_phone": "+5491111111", "role": "assistant", "content": "en qué te ayudo?"},
            format="json",
        )

        response = self.client.get("/api/conversations/mine/?customer_phone=%2B5491111111")

        mensajes = response.json()["mensajes"]
        self.assertEqual([m["content"] for m in mensajes], ["hola", "en qué te ayudo?"])

    def test_get_solo_devuelve_mensajes_no_resumidos(self):
        conversation = Conversation.objects.create(tenant=self.tenant_a, customer_phone="+5491111111")
        m1 = Message.objects.create(conversation=conversation, role="user", content="mensaje viejo 1")
        Message.objects.create(conversation=conversation, role="assistant", content="mensaje viejo 2")
        Message.objects.create(conversation=conversation, role="user", content="mensaje nuevo")
        conversation.resumido_hasta_id = m1.id + 1  # plegó los primeros dos
        conversation.resumen = "El cliente saludó."
        conversation.save(update_fields=["resumido_hasta_id", "resumen"])

        response = self.client.get("/api/conversations/mine/?customer_phone=%2B5491111111")

        data = response.json()
        self.assertEqual(data["resumen"], "El cliente saludó.")
        self.assertEqual([m["content"] for m in data["mensajes"]], ["mensaje nuevo"])

    def test_patch_actualiza_el_resumen(self):
        conversation = Conversation.objects.create(tenant=self.tenant_a, customer_phone="+5491111111")
        m1 = Message.objects.create(conversation=conversation, role="user", content="hola")

        response = self.client.patch(
            "/api/conversations/mine/",
            {"customer_phone": "+5491111111", "resumen": "Resumen de prueba.", "resumido_hasta": m1.id},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        conversation.refresh_from_db()
        self.assertEqual(conversation.resumen, "Resumen de prueba.")
        self.assertEqual(conversation.resumido_hasta_id, m1.id)

    def test_no_ve_conversaciones_de_otro_tenant(self):
        Conversation.objects.create(tenant=self.tenant_b, customer_phone="+5492222222")

        response = self.client.get("/api/conversations/mine/?customer_phone=%2B5492222222")

        # No existe en tenant_a -- el bot la crea de cero ahí, no ve la de tenant_b.
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Conversation.all_objects.filter(tenant=self.tenant_a, customer_phone="+5492222222").count(), 1)
        self.assertEqual(Conversation.all_objects.filter(tenant=self.tenant_b, customer_phone="+5492222222").count(), 1)

    def test_requiere_bot_token(self):
        client = APIClient()
        response = client.get("/api/conversations/mine/?customer_phone=%2B5491111111")
        self.assertEqual(response.status_code, 403)


class ConversationViewSetTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-conv-staff", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-conv-staff", plan="basico")
        self.admin = User.objects.create_user(
            username="admin-conv", password="testpass123", tenant=self.tenant_a, rol=User.ROL_ADMIN, nombre="Admin"
        )
        self.conv_a = Conversation.objects.create(
            tenant=self.tenant_a, customer_phone="+5491111111", estado=Conversation.ESTADO_REQUIERE_ATENCION
        )
        Conversation.objects.create(tenant=self.tenant_b, customer_phone="+5492222222")
        self.client = APIClient()
        authenticate_as(self.client, self.admin)

    def test_lista_solo_las_conversaciones_del_propio_tenant(self):
        response = self.client.get("/api/conversations/")

        telefonos = [c["customer_phone"] for c in response.json()]
        self.assertEqual(telefonos, ["+5491111111"])

    def test_el_estado_se_puede_consultar(self):
        response = self.client.get(f"/api/conversations/{self.conv_a.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], Conversation.ESTADO_REQUIERE_ATENCION)
