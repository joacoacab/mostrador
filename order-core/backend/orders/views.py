from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from .models import Order
from .serializers import OrderCreateSerializer, OrderSerializer


class OrderViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    # A propósito no es un ModelViewSet: todavía no hay diseño para
    # update/delete genéricos de un pedido. El cambio de estado va a
    # tener su propio endpoint validado contra la máquina de estados
    # (tarea 12), no un PATCH libre.

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

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

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)

    def create(self, request, *args, **kwargs):
        # OrderCreateSerializer es de escritura (sus items no traen id
        # ni precio_unitario_snapshot); la respuesta se arma con el
        # serializer de lectura para devolver el pedido completo.
        write_serializer = self.get_serializer(data=request.data)
        write_serializer.is_valid(raise_exception=True)
        self.perform_create(write_serializer)

        read_serializer = OrderSerializer(write_serializer.instance, context=self.get_serializer_context())
        headers = self.get_success_headers(read_serializer.data)
        return Response(read_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
