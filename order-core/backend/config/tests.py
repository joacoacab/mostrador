from django.core.management import call_command
from django.test import TestCase


class OpenAPISchemaTests(TestCase):
    def test_schema_generates_without_warnings_or_errors(self):
        # Regresión para la tarea 18b: si se agrega una vista sin
        # serializer, o un authentication_class sin su
        # OpenApiAuthenticationExtension, este comando falla (via
        # --fail-on-warn) y el test lo agarra acá en vez de que
        # aparezca recién mirando /api/docs/ a mano.
        call_command("spectacular", "--validate", "--fail-on-warn", "--file", "/dev/null")
