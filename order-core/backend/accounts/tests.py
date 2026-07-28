from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from tenancy.context import get_current_tenant_id
from tenants.models import Tenant

from .authentication import TenantAwareJWTAuthentication
from .models import User


class AuthJWTTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-auth", plan="basico")
        self.admin_user = User.objects.create_user(
            username="admin1",
            password="testpass123",
            tenant=self.tenant,
            rol=User.ROL_ADMIN,
            nombre="Admin Uno",
        )
        self.empleado_user = User.objects.create_user(
            username="empleado1",
            password="testpass123",
            tenant=self.tenant,
            rol=User.ROL_EMPLEADO,
            nombre="Empleado Uno",
        )
        self.client = APIClient()

    def _login(self, username, password="testpass123"):
        response = self.client.post(
            "/api/auth/token/", {"username": username, "password": password}
        )
        return response

    def test_login_devuelve_tokens_validos(self):
        response = self._login("admin1")
        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_con_credenciales_invalidas_falla(self):
        response = self._login("admin1", password="incorrecta")
        self.assertEqual(response.status_code, 401)

    def test_endpoint_protegido_rechaza_sin_token(self):
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 401)

    def test_endpoint_protegido_acepta_con_token(self):
        access = self._login("admin1").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["rol"], User.ROL_ADMIN)
        self.assertEqual(response.data["tenant"], self.tenant.id)

    def test_admin_ping_rechaza_rol_empleado(self):
        access = self._login("empleado1").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/auth/admin-ping/")
        self.assertEqual(response.status_code, 403)

    def test_admin_ping_acepta_rol_admin(self):
        access = self._login("admin1").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/auth/admin-ping/")
        self.assertEqual(response.status_code, 200)


class TenantAwareJWTAuthenticationTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-jwtauth", plan="basico")
        self.user = User.objects.create_user(
            username="jwtuser",
            password="testpass123",
            tenant=self.tenant,
            rol=User.ROL_ADMIN,
            nombre="JWT User",
        )

    def test_get_user_fija_el_tenant_en_contexto(self):
        access_token = RefreshToken.for_user(self.user).access_token
        resolved_user = TenantAwareJWTAuthentication().get_user(access_token)

        self.assertEqual(resolved_user.id, self.user.id)
        self.assertEqual(get_current_tenant_id(), self.tenant.id)
