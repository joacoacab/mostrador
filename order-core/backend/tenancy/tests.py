from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import RequestFactory, TestCase

from accounts.models import User
from tenants.models import Tenant

from .context import get_current_tenant_id, tenant_context
from .middleware import TenantMiddleware


class TenantScopedManagerTests(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(nombre="Tenant A", slug="tenant-a", plan="basico")
        self.tenant_b = Tenant.objects.create(nombre="Tenant B", slug="tenant-b", plan="basico")
        self.user_a = User.objects.create_user(
            username="user-a", tenant=self.tenant_a, rol=User.ROL_ADMIN, nombre="User A"
        )
        self.user_b = User.objects.create_user(
            username="user-b", tenant=self.tenant_b, rol=User.ROL_ADMIN, nombre="User B"
        )

    def test_scoped_manager_only_returns_current_tenant(self):
        with tenant_context(self.tenant_a.id):
            users = list(User.tenant_scoped.all())
        self.assertEqual(users, [self.user_a])

    def test_scoped_manager_does_not_leak_across_tenants(self):
        with tenant_context(self.tenant_b.id):
            usernames = set(User.tenant_scoped.values_list("username", flat=True))
        self.assertIn(self.user_b.username, usernames)
        self.assertNotIn(self.user_a.username, usernames)

    def test_scoped_manager_without_tenant_context_returns_nothing(self):
        users = list(User.tenant_scoped.all())
        self.assertEqual(users, [])


class TenantMiddlewareTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(nombre="Tenant A", slug="tenant-a-mw", plan="basico")
        self.user = User.objects.create_user(
            username="mw-user", tenant=self.tenant, rol=User.ROL_ADMIN, nombre="MW User"
        )
        self.factory = RequestFactory()

    def test_sets_tenant_from_authenticated_user(self):
        captured = {}

        def get_response(request):
            captured["tenant_id"] = get_current_tenant_id()
            return HttpResponse()

        middleware = TenantMiddleware(get_response)
        request = self.factory.get("/")
        request.user = self.user
        middleware(request)

        self.assertEqual(captured["tenant_id"], self.tenant.id)

    def test_clears_context_after_response(self):
        middleware = TenantMiddleware(lambda request: HttpResponse())
        request = self.factory.get("/")
        request.user = self.user
        middleware(request)

        self.assertIsNone(get_current_tenant_id())

    def test_anonymous_user_has_no_tenant(self):
        captured = {}

        def get_response(request):
            captured["tenant_id"] = get_current_tenant_id()
            return HttpResponse()

        middleware = TenantMiddleware(get_response)
        request = self.factory.get("/")
        request.user = AnonymousUser()
        middleware(request)

        self.assertIsNone(captured["tenant_id"])
