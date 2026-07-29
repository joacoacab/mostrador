from drf_spectacular.extensions import OpenApiAuthenticationExtension


class DeviceTokenAuthenticationScheme(OpenApiAuthenticationExtension):
    target_class = "tenants.authentication.DeviceTokenAuthentication"
    name = "deviceTokenAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Formato: `DeviceToken <token>` (ver tarea 21, pairing de pantalla).",
        }
