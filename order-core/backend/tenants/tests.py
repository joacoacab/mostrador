from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from accounts.testing import authenticate_as
from catalog.models import Product
from orders.models import Customer, Order

from .models import BotToken, PairingCode, Tenant


class TenantInfoTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(
            nombre="Tenant A", slug="tenant-a-info", plan="basico",
            horarios="Lunes a viernes 9 a 18", ubicacion="Av. Siempre Viva 742",
            medios_pago="Efectivo, transferencia",
        )
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-info", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a-info", password="testpass123", tenant=self.tenant_a,
            rol=User.ROL_ADMIN, nombre="User A",
        )
        self.client = APIClient()

    def test_rechaza_sin_autenticacion(self):
        response = self.client.get("/api/tenant-info/")
        self.assertEqual(response.status_code, 401)

    def test_devuelve_la_info_del_tenant_propio(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.get("/api/tenant-info/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["nombre"], "Tenant A")
        self.assertEqual(response.data["horarios"], "Lunes a viernes 9 a 18")
        self.assertEqual(response.data["ubicacion"], "Av. Siempre Viva 742")
        self.assertEqual(response.data["medios_pago"], "Efectivo, transferencia")

    def test_campos_vacios_por_default(self):
        user_b = User.objects.create_user(
            username="user-b-info", password="testpass123", tenant=self.tenant_b,
            rol=User.ROL_ADMIN, nombre="User B",
        )
        authenticate_as(self.client, user_b)
        response = self.client.get("/api/tenant-info/")
        self.assertEqual(response.data["horarios"], "")
        self.assertEqual(response.data["ubicacion"], "")
        self.assertEqual(response.data["medios_pago"], "")


class PairingGenerateTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-pairing-gen", plan="basico")
        self.user = User.objects.create_user(
            username="user-pairing-gen", password="testpass123", tenant=self.tenant,
            rol=User.ROL_ADMIN, nombre="User",
        )
        self.client = APIClient()

    def test_rechaza_sin_autenticacion(self):
        response = self.client.post("/api/pairing/generate/")
        self.assertEqual(response.status_code, 401)

    def test_genera_codigo_para_el_tenant_del_usuario(self):
        authenticate_as(self.client, self.user)
        response = self.client.post("/api/pairing/generate/")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.data["code"]), 6)
        pairing = PairingCode.objects.get(code=response.data["code"], tenant=self.tenant)
        self.assertIsNone(pairing.claimed_at)


class PairingClaimTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-pairing-claim", plan="basico")
        self.client = APIClient()

    def test_canjea_codigo_valido_sin_autenticacion(self):
        pairing = PairingCode.objects.create(tenant=self.tenant)
        response = self.client.post("/api/pairing/claim/", {"code": pairing.code})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tenant_nombre"], "Tenant A")
        self.assertEqual(response.data["device_token"], pairing.device_token)
        pairing.refresh_from_db()
        self.assertIsNotNone(pairing.claimed_at)

    def test_codigo_inexistente_da_400(self):
        response = self.client.post("/api/pairing/claim/", {"code": "000000"})
        self.assertEqual(response.status_code, 400)

    def test_codigo_ya_canjeado_no_se_puede_reusar(self):
        pairing = PairingCode.objects.create(tenant=self.tenant, claimed_at=timezone.now())
        response = self.client.post("/api/pairing/claim/", {"code": pairing.code})
        self.assertEqual(response.status_code, 400)

    def test_codigo_vencido_da_400(self):
        pairing = PairingCode.objects.create(
            tenant=self.tenant, expires_at=timezone.now() - timedelta(minutes=1)
        )
        response = self.client.post("/api/pairing/claim/", {"code": pairing.code})
        self.assertEqual(response.status_code, 400)


class DeviceTokenAuthenticationTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-device", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-device", plan="basico")
        self.pairing_a = PairingCode.objects.create(tenant=self.tenant_a, claimed_at=timezone.now())
        self.customer_a = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente A"
        )
        self.order_a = Order.all_objects.create(
            tenant=self.tenant_a, customer=self.customer_a, canal=Order.CANAL_MANUAL
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )
        self.order_b = Order.all_objects.create(
            tenant=self.tenant_b, customer=self.customer_b, canal=Order.CANAL_MANUAL
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"DeviceToken {self.pairing_a.device_token}")

    def test_lista_solo_pedidos_del_tenant_pareado(self):
        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 200)
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a.id})

    def test_token_invalido_da_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="DeviceToken token-que-no-existe")
        response = client.get("/api/orders/")
        self.assertEqual(response.status_code, 401)

    def test_token_no_canjeado_no_autentica(self):
        unclaimed = PairingCode.objects.create(tenant=self.tenant_a)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"DeviceToken {unclaimed.device_token}")
        response = client.get("/api/orders/")
        self.assertEqual(response.status_code, 401)

    def test_no_puede_crear_pedidos(self):
        response = self.client.post(
            "/api/orders/",
            {"customer": self.customer_a.id, "canal": Order.CANAL_MANUAL, "items": []},
            format="json",
        )
        self.assertEqual(response.status_code, 403)

    def test_no_puede_cambiar_estado(self):
        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/status/", {"estado": Order.ESTADO_CONFIRMADO}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_no_sirve_para_otros_endpoints(self):
        # DeviceTokenAuthentication se agregó solo en OrderViewSet a
        # propósito -- ver la nota en config/settings.py. Un device
        # token no debería servir en /api/products/, por ejemplo.
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 401)


class BotTokenAuthenticationTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(
            nombre="Tenant A", slug="tenant-a-bot", plan="basico",
            horarios="9 a 18", ubicacion="Acá cerca", medios_pago="Efectivo",
        )
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-bot", plan="basico")
        self.bot_token = BotToken.objects.create(tenant=self.tenant_a)
        self.product_a = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Chipa", precio="2000.00", unidad="docena", disponible=True
        )
        self.customer_a = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente A"
        )
        self.order_a = Order.all_objects.create(
            tenant=self.tenant_a, customer=self.customer_a, canal=Order.CANAL_WHATSAPP
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )
        self.order_b = Order.all_objects.create(
            tenant=self.tenant_b, customer=self.customer_b, canal=Order.CANAL_WHATSAPP
        )
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"BotToken {self.bot_token.token}")

    def test_token_invalido_da_401(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="BotToken token-que-no-existe")
        response = client.get("/api/orders/")
        self.assertEqual(response.status_code, 401)

    def test_token_inactivo_no_autentica(self):
        self.bot_token.active = False
        self.bot_token.save(update_fields=["active"])
        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 401)

    def test_lee_catalogo(self):
        response = self.client.get("/api/catalog/")
        self.assertEqual(response.status_code, 200)
        nombres = {p["nombre"] for p in response.data}
        self.assertEqual(nombres, {"Chipa"})

    def test_lee_info_del_tenant(self):
        response = self.client.get("/api/tenant-info/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["horarios"], "9 a 18")

    def test_busca_y_crea_clientes(self):
        response = self.client.get("/api/customers/", {"telefono": self.customer_a.telefono})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

        response = self.client.post("/api/customers/", {"telefono": "+5493333333", "nombre": "Nuevo"})
        self.assertEqual(response.status_code, 201)
        created = Customer.all_objects.get(id=response.data["id"])
        self.assertEqual(created.tenant_id, self.tenant_a.id)

    def test_lista_solo_pedidos_del_tenant_propio(self):
        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 200)
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a.id})

    def test_puede_crear_pedidos(self):
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer_a.id,
                "canal": Order.CANAL_WHATSAPP,
                "items": [{"product": self.product_a.id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        order = Order.all_objects.get(id=response.data["id"])
        self.assertEqual(order.tenant_id, self.tenant_a.id)

    def test_no_puede_usar_producto_de_otro_tenant(self):
        product_b = Product.all_objects.create(
            tenant=self.tenant_b, nombre="Milanesa", precio="5000.00", unidad="kg", disponible=True
        )
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer_a.id,
                "canal": Order.CANAL_WHATSAPP,
                "items": [{"product": product_b.id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_no_puede_cambiar_estado(self):
        response = self.client.patch(
            f"/api/orders/{self.order_a.id}/status/", {"estado": Order.ESTADO_CONFIRMADO}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_puede_cancelar_un_pedido_propio(self):
        response = self.client.post(
            f"/api/orders/{self.order_a.id}/cancel/", {"customer_phone": self.customer_a.telefono}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["estado"], Order.ESTADO_CANCELADO)

    def test_no_puede_cancelar_sin_mandar_customer_phone(self):
        response = self.client.post(f"/api/orders/{self.order_a.id}/cancel/")
        self.assertEqual(response.status_code, 403)
        self.order_a.refresh_from_db()
        self.assertEqual(self.order_a.estado, Order.ESTADO_PENDIENTE)

    def test_no_puede_cancelar_pedido_de_otro_cliente(self):
        otro_cliente = Customer.all_objects.create(tenant=self.tenant_a, telefono="+5493333333", nombre="Otro")
        otro_pedido = Order.all_objects.create(tenant=self.tenant_a, customer=otro_cliente, canal=Order.CANAL_WHATSAPP)

        response = self.client.post(
            f"/api/orders/{otro_pedido.id}/cancel/", {"customer_phone": self.customer_a.telefono}, format="json"
        )
        self.assertEqual(response.status_code, 403)
        otro_pedido.refresh_from_db()
        self.assertNotEqual(otro_pedido.estado, Order.ESTADO_CANCELADO)

    def test_no_sirve_para_otros_endpoints(self):
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 401)