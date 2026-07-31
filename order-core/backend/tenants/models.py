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

    # FAQ del bot de WhatsApp (spec 4.1, tool "responder preguntas
    # frecuentes"; tarea 24). Campos de texto libre, no estructurados
    # -- no hay ningún consumidor que necesite parsearlos todavía, y
    # cada rubro los va a redactar distinto (agnóstico de rubro, ver
    # CLAUDE.md). Todos opcionales: un tenant recién creado no tiene
    # por qué haberlos cargado.
    horarios = models.TextField(blank=True, default="")
    ubicacion = models.TextField(blank=True, default="")
    medios_pago = models.TextField(blank=True, default="")

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


def _generate_bot_token():
    return secrets.token_urlsafe(32)


class BotToken(models.Model):
    """Credencial del `whatsapp-agent` para hablarle al Order Core en
    nombre de un tenant (tarea 25, Fase 2).

    A diferencia de `PairingCode`, no hay flujo de "pairing": se
    genera directo (por ahora, a mano desde el admin) y se configura
    como variable de entorno del servicio del bot -- el bot es un
    servicio de confianza, no un dispositivo que un humano empareja.
    `active` permite revocar sin borrar (mantiene el registro de que
    existió).
    """

    tenant = models.ForeignKey("tenants.Tenant", on_delete=models.CASCADE, related_name="bot_tokens")
    token = models.CharField(max_length=64, unique=True, default=_generate_bot_token)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.tenant} (bot)"
