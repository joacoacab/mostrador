from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "nombre", "precio", "unidad", "disponible", "origen", "external_id"]
        read_only_fields = ["id"]
