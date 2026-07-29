from rest_framework import serializers

from .models import Customer, Order, OrderItem


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "telefono", "nombre", "created_at"]
        read_only_fields = ["id", "created_at"]


class OrderItemSerializer(serializers.ModelSerializer):
    product_nombre = serializers.CharField(source="product.nombre", read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_nombre", "cantidad", "precio_unitario_snapshot"]
        read_only_fields = ["id", "precio_unitario_snapshot"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    # Nombre/teléfono del cliente aplanados acá -- el kanban (tarea
    # 20) necesita mostrar algo más útil que un id en cada tarjeta, y
    # no amerita todavía un serializer anidado completo.
    customer_nombre = serializers.CharField(source="customer.nombre", read_only=True)
    customer_telefono = serializers.CharField(source="customer.telefono", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "customer",
            "customer_nombre",
            "customer_telefono",
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


class OrderItemCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["product", "cantidad"]
        # A propósito NO incluye precio_unitario_snapshot: el cliente
        # no elige el precio, se copia del Product en el momento de
        # crear el pedido (OrderCreateSerializer.create). El campo
        # `product` es un PrimaryKeyRelatedField que DRF arma en cada
        # request a partir de Product.objects (scopeado por tenant),
        # así que referenciar un producto de otro tenant ya falla acá
        # con un 400, sin necesidad de chequearlo a mano.


class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemCreateSerializer(many=True)

    class Meta:
        model = Order
        fields = ["id", "customer", "canal", "notas", "items"]
        read_only_fields = ["id"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("El pedido necesita al menos un producto.")
        return items

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        for item_data in items_data:
            product = item_data["product"]
            OrderItem.objects.create(
                order=order,
                product=product,
                cantidad=item_data["cantidad"],
                precio_unitario_snapshot=product.precio,
            )
        return order


class OrderStatusSerializer(serializers.Serializer):
    estado = serializers.ChoiceField(choices=Order.ESTADO_CHOICES)
