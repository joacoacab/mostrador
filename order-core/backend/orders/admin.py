from django.contrib import admin

from .models import Customer, Order, OrderItem


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "tenant", "created_at")
    list_filter = ("tenant",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "customer", "canal", "estado", "created_at")
    list_filter = ("tenant", "canal", "estado")
    inlines = [OrderItemInline]
