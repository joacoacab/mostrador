from django.urls import path

from .views import PairingClaimView, PairingGenerateView, TenantInfoView

urlpatterns = [
    path("pairing/generate/", PairingGenerateView.as_view(), name="pairing_generate"),
    path("pairing/claim/", PairingClaimView.as_view(), name="pairing_claim"),
    path("tenant-info/", TenantInfoView.as_view(), name="tenant_info"),
]
