from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.testing import authenticate_as
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


class ProductAPITests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-api", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-api", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a-api", password="testpass123", tenant=self.tenant_a,
            rol=User.ROL_ADMIN, nombre="User A",
        )
        self.user_b = User.objects.create_user(
            username="user-b-api", password="testpass123", tenant=self.tenant_b,
            rol=User.ROL_ADMIN, nombre="User B",
        )
        self.product_a = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Milanesa", precio="5000", unidad="kg"
        )
        self.product_b = Product.all_objects.create(
            tenant=self.tenant_b, nombre="Chipa", precio="2000", unidad="docena"
        )
        self.client = APIClient()

    def test_rechaza_sin_autenticacion(self):
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 401)

    def test_lista_solo_productos_del_tenant_propio(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.get("/api/products/")
        self.assertEqual(response.status_code, 200)
        nombres = {p["nombre"] for p in response.data["results"]} if "results" in response.data else {
            p["nombre"] for p in response.data
        }
        self.assertEqual(nombres, {"Milanesa"})

    def test_no_puede_leer_producto_de_otro_tenant(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.get(f"/api/products/{self.product_b.id}/")
        self.assertEqual(response.status_code, 404)

    def test_no_puede_modificar_producto_de_otro_tenant(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.patch(f"/api/products/{self.product_b.id}/", {"nombre": "Hackeado"})
        self.assertEqual(response.status_code, 404)
        self.product_b.refresh_from_db()
        self.assertEqual(self.product_b.nombre, "Chipa")

    def test_no_puede_borrar_producto_de_otro_tenant(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.delete(f"/api/products/{self.product_b.id}/")
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Product.all_objects.filter(id=self.product_b.id).exists())

    def test_crear_producto_lo_asocia_al_tenant_del_usuario(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.post(
            "/api/products/",
            {"nombre": "Bondiola", "precio": "8000", "unidad": "kg", "disponible": True, "origen": Product.ORIGEN_MANUAL},
        )
        self.assertEqual(response.status_code, 201)
        created = Product.all_objects.get(id=response.data["id"])
        self.assertEqual(created.tenant_id, self.tenant_a.id)

    def test_actualiza_producto_del_tenant_propio(self):
        authenticate_as(self.client, self.user_a)
        response = self.client.patch(f"/api/products/{self.product_a.id}/", {"precio": "5500"})
        self.assertEqual(response.status_code, 200)
        self.product_a.refresh_from_db()
        self.assertEqual(str(self.product_a.precio), "5500.00")


class CatalogViewTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-catalog", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b-catalog", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a-catalog", password="testpass123", tenant=self.tenant_a,
            rol=User.ROL_ADMIN, nombre="User A",
        )
        self.disponible = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Chipa", precio="2000", unidad="docena", disponible=True
        )
        self.no_disponible = Product.all_objects.create(
            tenant=self.tenant_a, nombre="Milanesa", precio="5000", unidad="kg", disponible=False
        )
        self.de_otro_tenant = Product.all_objects.create(
            tenant=self.tenant_b, nombre="Empanada", precio="1000", unidad="unidad", disponible=True
        )
        self.client = APIClient()
        authenticate_as(self.client, self.user_a)

    def test_solo_lista_disponibles_del_tenant_propio(self):
        response = self.client.get("/api/catalog/")
        self.assertEqual(response.status_code, 200)
        nombres = {p["nombre"] for p in response.data}
        self.assertEqual(nombres, {"Chipa"})

    def test_rechaza_sin_autenticacion(self):
        client = APIClient()
        response = client.get("/api/catalog/")
        self.assertEqual(response.status_code, 401)
