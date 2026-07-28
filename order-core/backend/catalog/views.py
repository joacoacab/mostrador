from rest_framework import viewsets

from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer

    def get_queryset(self):
        # Method, no atributo de clase: Product.objects ya está
        # scopeado por tenant (TenantManager), pero eso depende del
        # tenant en contexto AL MOMENTO DEL REQUEST. Un `queryset =
        # Product.objects.all()` a nivel de clase se evaluaría una
        # sola vez al importar el módulo, antes de que exista
        # cualquier tenant en contexto, y quedaría congelado vacío.
        return Product.objects.all()

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)
