from django.test import TestCase

from tenancy.context import tenant_context
from tenants.models import Tenant

from .models import Product


class ProductScopingTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b", plan="basico")
        self.product_a = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Milanesa", precio="5000", unidad="kg"
        )
        self.product_b = Product.all_objects.create(
            tenant=self.tenant_b, nombre="Chipa", precio="2000", unidad="docena"
        )

    def test_scoped_manager_only_returns_current_tenant(self):
        with tenant_context(self.tenant_a.id):
            products = list(Product.objects.all())
        self.assertEqual(products, [self.product_a])

    def test_scoped_manager_does_not_leak_across_tenants(self):
        with tenant_context(self.tenant_b.id):
            nombres = set(Product.objects.values_list("nombre", flat=True))
        self.assertIn(self.product_b.nombre, nombres)
        self.assertNotIn(self.product_a.nombre, nombres)

    def test_scoped_manager_without_tenant_context_returns_nothing(self):
        self.assertEqual(list(Product.objects.all()), [])
