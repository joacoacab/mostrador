from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Mostrador", {"fields": ("tenant", "rol", "nombre")}),
    )
    list_display = ("username", "email", "nombre", "tenant", "rol", "is_staff")
