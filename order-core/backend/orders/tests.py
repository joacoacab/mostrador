from django.test import TestCase

from tenancy.context import tenant_context
from tenants.models import Tenant

from .models import Customer


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
