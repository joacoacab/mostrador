import secrets
import string
from datetime import timedelta

from django.db import models
from django.utils import timezone


class Tenant(models.Model):
    nombre = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    plan = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre


def _generate_code():
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _generate_device_token():
    return secrets.token_urlsafe(32)


def _default_expiry():
    return timezone.now() + timedelta(minutes=10)


class PairingCode(models.Model):
    """Pairing de la pantalla tablet/TV (spec sección 3.5, tarea 21).

    La pantalla no tiene login, así que necesita otra forma de
    autenticarse contra la API. Flujo: un operador logueado genera un
    código de 6 dígitos desde el panel (`code`); lo escribe en la
    tablet; la tablet lo canjea por un `device_token` de larga
    duración que usa de ahí en más (header `Authorization:
    DeviceToken <token>`, ver tenants/authentication.py).

    `code` NO es único a nivel de base: son 6 dígitos y los códigos
    viejos (vencidos o ya canjeados) pueden repetirse con el tiempo
    sin que importe -- el canje siempre filtra por
    claimed_at=None y expires_at futuro, y toma el más reciente.
    `device_token` sí es único: es la credencial real.
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="pairing_codes")
    code = models.CharField(max_length=6, default=_generate_code)
    device_token = models.CharField(max_length=64, unique=True, default=_generate_device_token)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_expiry)
    claimed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.tenant} ({self.code})"
