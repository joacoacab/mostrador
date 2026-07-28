from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import CatalogView, ProductViewSet

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")

urlpatterns = router.urls + [
    path("catalog/", CatalogView.as_view(), name="catalog"),
]
