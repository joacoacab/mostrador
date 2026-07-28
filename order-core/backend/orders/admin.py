from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("nombre", "telefono", "tenant", "created_at")
    list_filter = ("tenant",)
