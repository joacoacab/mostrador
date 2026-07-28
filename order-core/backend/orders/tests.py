from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.testing import authenticate_as
from catalog.models import Product
from tenancy.context import tenant_context
from tenants.models import Tenant

from .models import Customer, Order, OrderEvent, OrderItem


class CustomerScopingTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b", plan="basico")
        self.customer_a = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente A"
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )

    def test_scoped_manager_only_returns_current_tenant(self):
        with tenant_context(self.tenant_a.id):
            customers = list(Customer.objects.all())
        self.assertEqual(customers, [self.customer_a])

    def test_scoped_manager_does_not_leak_across_tenants(self):
        with tenant_context(self.tenant_b.id):
            nombres = set(Customer.objects.values_list("nombre", flat=True))
        self.assertIn(self.customer_b.nombre, nombres)
        self.assertNotIn(self.customer_a.nombre, nombres)

    def test_scoped_manager_without_tenant_context_returns_nothing(self):
        self.assertEqual(list(Customer.objects.all()), [])

    def test_telefono_unico_por_tenant(self):
        from django.db import IntegrityError

        with self.assertRaises(IntegrityError):
            Customer.all_objects.create(
                tenant=self.tenant_a, telefono="+5491111111", nombre="Otro Cliente"
            )


class OrderScopingTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-ord", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-ord", plan="basico")
        self.customer_a = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente A"
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )
        self.order_a = Order.all_objects.create(
            tenant=self.tenant_a, customer=self.customer_a, canal=Order.CANAL_MANUAL
        )
        self.order_b = Order.all_objects.create(
            tenant=self.tenant_b, customer=self.customer_b, canal=Order.CANAL_MANUAL
        )

    def test_scoped_manager_only_returns_current_tenant(self):
        with tenant_context(self.tenant_a.id):
            orders = list(Order.objects.all())
        self.assertEqual(orders, [self.order_a])

    def test_scoped_manager_does_not_leak_across_tenants(self):
        with tenant_context(self.tenant_b.id):
            ids = set(Order.objects.values_list("id", flat=True))
        self.assertIn(self.order_b.id, ids)
        self.assertNotIn(self.order_a.id, ids)

    def test_scoped_manager_without_tenant_context_returns_nothing(self):
        self.assertEqual(list(Order.objects.all()), [])


class OrderItemSnapshotTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-item", plan="basico")
        self.customer = Customer.all_objects.create(
            tenant=self.tenant, telefono="+5491111111", nombre="Cliente A"
        )
        self.product = Product.all_objects.create(
            tenant=self.tenant, nombre="Chipa", precio="2000.00", unidad="docena"
        )
        self.order = Order.all_objects.create(
            tenant=self.tenant, customer=self.customer, canal=Order.CANAL_MANUAL
        )

    def test_precio_queda_congelado_aunque_el_producto_cambie(self):
        item = OrderItem.objects.create(
            order=self.order,
            product=self.product,
            cantidad="2",
            precio_unitario_snapshot=self.product.precio,
        )

        self.product.precio = "3500.00"
        self.product.save()

        item.refresh_from_db()
        self.assertEqual(str(item.precio_unitario_snapshot), "2000.00")


class OrderEventTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-event", plan="basico")
        self.customer = Customer.all_objects.create(
            tenant=self.tenant, telefono="+5491111111", nombre="Cliente A"
        )
        self.order = Order.all_objects.create(
            tenant=self.tenant, customer=self.customer, canal=Order.CANAL_MANUAL
        )

    def test_crea_evento_asociado_al_pedido(self):
        event = OrderEvent.objects.create(
            order=self.order,
            estado_anterior=None,
            estado_nuevo=Order.ESTADO_PENDIENTE,
            actor=OrderEvent.ACTOR_SISTEMA,
        )

        self.assertEqual(list(self.order.events.all()), [event])
        self.assertIsNotNone(event.created_at)


class OrderReadAPITests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-read", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-read", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a-read", password="testpass123", tenant=self.tenant_a,
            rol=User.ROL_ADMIN, nombre="User A",
        )
        self.customer_a1 = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente 1"
        )
        self.customer_a2 = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111112", nombre="Cliente 2"
        )
        self.order_a1 = Order.all_objects.create(
            tenant=self.tenant_a, customer=self.customer_a1, canal=Order.CANAL_MANUAL,
            estado=Order.ESTADO_PENDIENTE,
        )
        self.order_a2 = Order.all_objects.create(
            tenant=self.tenant_a, customer=self.customer_a2, canal=Order.CANAL_MANUAL,
            estado=Order.ESTADO_CONFIRMADO,
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )
        self.order_b = Order.all_objects.create(
            tenant=self.tenant_b, customer=self.customer_b, canal=Order.CANAL_MANUAL
        )
        self.client = APIClient()
        authenticate_as(self.client, self.user_a)

    def test_lista_solo_pedidos_del_tenant_propio(self):
        response = self.client.get("/api/orders/")
        self.assertEqual(response.status_code, 200)
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a1.id, self.order_a2.id})

    def test_filtra_por_estado(self):
        response = self.client.get("/api/orders/", {"estado": Order.ESTADO_CONFIRMADO})
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a2.id})

    def test_filtra_por_customer(self):
        response = self.client.get("/api/orders/", {"customer": self.customer_a1.id})
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a1.id})

    def test_filtra_por_customer_phone(self):
        response = self.client.get("/api/orders/", {"customer_phone": self.customer_a1.telefono})
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a1.id})

    def test_filtra_por_fecha(self):
        fecha = self.order_a1.created_at.date().isoformat()
        response = self.client.get("/api/orders/", {"fecha": fecha})
        ids = {o["id"] for o in response.data}
        self.assertEqual(ids, {self.order_a1.id, self.order_a2.id})

    def test_no_puede_leer_pedido_de_otro_tenant(self):
        response = self.client.get(f"/api/orders/{self.order_b.id}/")
        self.assertEqual(response.status_code, 404)

    def test_customer_phone_de_otro_tenant_no_devuelve_nada(self):
        response = self.client.get("/api/orders/", {"customer_phone": self.customer_b.telefono})
        self.assertEqual(response.data, [])


class OrderCreateAPITests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-create", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-create", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a-create", password="testpass123", tenant=self.tenant_a,
            rol=User.ROL_ADMIN, nombre="User A",
        )
        self.customer_a = Customer.all_objects.create(
            tenant=self.tenant_a, telefono="+5491111111", nombre="Cliente A"
        )
        self.product_a = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Chipa", precio="2000.00", unidad="docena"
        )
        self.customer_b = Customer.all_objects.create(
            tenant=self.tenant_b, telefono="+5492222222", nombre="Cliente B"
        )
        self.product_b = Product.all_objects.create(
            tenant=self.tenant_b, nombre="Milanesa", precio="5000.00", unidad="kg"
        )
        self.client = APIClient()
        authenticate_as(self.client, self.user_a)

    def test_crea_pedido_con_items_y_congela_el_precio(self):
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer_a.id,
                "canal": Order.CANAL_MANUAL,
                "items": [{"product": self.product_a.id, "cantidad": "3"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        order = Order.all_objects.get(id=response.data["id"])
        self.assertEqual(order.tenant_id, self.tenant_a.id)
        self.assertEqual(order.estado, Order.ESTADO_PENDIENTE)

        item = order.items.get()
        self.assertEqual(str(item.precio_unitario_snapshot), "2000.00")

        self.product_a.precio = "9999.00"
        self.product_a.save()
        item.refresh_from_db()
        self.assertEqual(str(item.precio_unitario_snapshot), "2000.00")

    def test_no_puede_crear_pedido_sin_items(self):
        response = self.client.post(
            "/api/orders/",
            {"customer": self.customer_a.id, "canal": Order.CANAL_MANUAL, "items": []},
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_no_puede_usar_producto_de_otro_tenant(self):
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer_a.id,
                "canal": Order.CANAL_MANUAL,
                "items": [{"product": self.product_b.id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)

    def test_no_puede_usar_cliente_de_otro_tenant(self):
        response = self.client.post(
            "/api/orders/",
            {
                "customer": self.customer_b.id,
                "canal": Order.CANAL_MANUAL,
                "items": [{"product": self.product_a.id, "cantidad": "1"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
