from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("nombre", "tenant", "precio", "unidad", "disponible", "origen")
    list_filter = ("tenant", "disponible", "origen")
