from rest_framework import serializers

from .models import Order, OrderItem


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "product", "cantidad", "precio_unitario_snapshot"]
        read_only_fields = ["id", "precio_unitario_snapshot"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "canal",
            "estado",
            "notas",
            "created_at",
            "updated_at",
            "items",
        ]
        # estado no se toca por acá: tiene su propio endpoint con
        # validación de máquina de estados (tarea 12).
        read_only_fields = ["id", "estado", "created_at", "updated_at"]
