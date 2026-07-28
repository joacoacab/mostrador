from rest_framework import viewsets

from .models import Order
from .serializers import OrderSerializer


class OrderViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = OrderSerializer

    def get_queryset(self):
        # Method, no atributo de clase -- ver la nota en
        # catalog/views.py::ProductViewSet.get_queryset sobre por qué
        # `queryset = Order.objects.all()` a nivel de clase rompería
        # el scoping por tenant.
        queryset = Order.objects.all().order_by("-created_at")

        estado = self.request.query_params.get("estado")
        if estado:
            queryset = queryset.filter(estado=estado)

        customer_id = self.request.query_params.get("customer")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)

        customer_phone = self.request.query_params.get("customer_phone")
        if customer_phone:
            queryset = queryset.filter(customer__telefono=customer_phone)

        fecha = self.request.query_params.get("fecha")
        if fecha:
            queryset = queryset.filter(created_at__date=fecha)

        return queryset
