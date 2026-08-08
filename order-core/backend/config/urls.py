"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from accounts.views import AdminOnlyPingView, MeView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', MeView.as_view(), name='auth_me'),
    path('api/auth/admin-ping/', AdminOnlyPingView.as_view(), name='auth_admin_ping'),
    path('api/', include('catalog.urls')),
    path('api/', include('orders.urls')),
    path('api/', include('tenants.urls')),
    path('api/', include('knowledge.urls')),
    # Documentación de API (tarea 18b). Público (AllowAny): la
    # documentación en sí no debería requerir estar logueado para
    # verse, aunque "probarla" desde el Swagger UI sí necesita pegar
    # un token válido -- eso es UX estándar de OpenAPI/Swagger.
    path(
        'api/schema/',
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name='schema',
    ),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema', permission_classes=[AllowAny]),
        name='swagger-ui',
    ),
]
