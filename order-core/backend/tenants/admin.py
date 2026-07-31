from django.contrib import admin

from .models import PairingCode, Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ("nombre", "slug", "plan", "created_at")
    prepopulated_fields = {"slug": ("nombre",)}
    fields = ("nombre", "slug", "plan", "horarios", "ubicacion", "medios_pago")


@admin.register(PairingCode)
class PairingCodeAdmin(admin.ModelAdmin):
    list_display = ("tenant", "code", "created_at", "expires_at", "claimed_at")
    list_filter = ("tenant",)
    readonly_fields = ("device_token",)
