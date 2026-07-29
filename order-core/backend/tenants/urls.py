from django.urls import path

from .views import PairingClaimView, PairingGenerateView

urlpatterns = [
    path("pairing/generate/", PairingGenerateView.as_view(), name="pairing_generate"),
    path("pairing/claim/", PairingClaimView.as_view(), name="pairing_claim"),
]
