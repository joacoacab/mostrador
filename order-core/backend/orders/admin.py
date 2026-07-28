from django.contrib import admin

from .models import Customer, Order, OrderEvent, OrderItem


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "tenant", "created_at")
    list_filter = ("tenant",)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class OrderEventInline(admin.TabularInline):
    model = OrderEvent
    extra = 0
    readonly_fields = ("estado_anterior", "estado_nuevo", "actor", "created_at")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "tenant", "customer", "canal", "estado", "created_at")
    list_filter = ("tenant", "canal", "estado")
    inlines = [OrderItemInline, OrderEventInline]
