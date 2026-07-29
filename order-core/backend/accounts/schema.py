from drf_spectacular.extensions import OpenApiAuthenticationExtension


class TenantAwareJWTAuthenticationScheme(OpenApiAuthenticationExtension):
    """Le dice a drf-spectacular cómo tratar TenantAwareJWTAuthentication.

    Sin esto, drf-spectacular no reconoce nuestra subclase de
    JWTAuthentication (busca la clase exacta, no hace issubclass) y
    el Swagger UI no ofrece cómo mandar el Bearer token al probar un
    endpoint protegido.
    """

    target_class = "accounts.authentication.TenantAwareJWTAuthentication"
    name = "jwtAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }
