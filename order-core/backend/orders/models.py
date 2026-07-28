from django.db import models

from catalog.models import Product
from tenancy.models import TenantScopedModel


class Customer(TenantScopedModel):
    telefono = models.CharField(max_length=32)
    nombre = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "telefono"], name="unique_telefono_por_tenant"
            )
        ]

    def __str__(self):
        return self.nombre


class Order(TenantScopedModel):
    CANAL_WHATSAPP = "whatsapp"
    CANAL_MANUAL = "manual"
    CANAL_CHOICES = [
        (CANAL_WHATSAPP, "WhatsApp"),
        (CANAL_MANUAL, "Manual"),
    ]

    ESTADO_PENDIENTE = "pendiente"
    ESTADO_CONFIRMADO = "confirmado"
    ESTADO_EN_PREPARACION = "en_preparacion"
    ESTADO_LISTO = "listo"
    ESTADO_EN_CAMINO = "en_camino"
    ESTADO_ENTREGADO = "entregado"
    ESTADO_CANCELADO = "cancelado"
    ESTADO_SIN_STOCK = "sin_stock"
    ESTADO_RECHAZADO = "rechazado"
    ESTADO_CHOICES = [
        (ESTADO_PENDIENTE, "Pendiente"),
        (ESTADO_CONFIRMADO, "Confirmado"),
        (ESTADO_EN_PREPARACION, "En preparación"),
        (ESTADO_LISTO, "Listo"),
        (ESTADO_EN_CAMINO, "En camino"),
        (ESTADO_ENTREGADO, "Entregado"),
        (ESTADO_CANCELADO, "Cancelado"),
        (ESTADO_SIN_STOCK, "Sin stock"),
        (ESTADO_RECHAZADO, "Rechazado"),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="orders")
    canal = models.CharField(max_length=20, choices=CANAL_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default=ESTADO_PENDIENTE)
    notas = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Pedido #{self.pk} ({self.estado})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    cantidad = models.DecimalField(max_digits=10, decimal_places=2)
    precio_unitario_snapshot = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.cantidad} x {self.product.nombre}"


class OrderEvent(models.Model):
    ACTOR_BOT = "bot"
    ACTOR_SISTEMA = "sistema"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="events")
    estado_anterior = models.CharField(
        max_length=20, choices=Order.ESTADO_CHOICES, blank=True, null=True
    )
    estado_nuevo = models.CharField(max_length=20, choices=Order.ESTADO_CHOICES)
    actor = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pedido #{self.order_id}: {self.estado_anterior} -> {self.estado_nuevo}"
