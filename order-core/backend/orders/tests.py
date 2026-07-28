from django.test import TestCase

from catalog.models import Product
from tenancy.context import tenant_context
from tenants.models import Tenant

from .models import Customer, Order, OrderItem


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
