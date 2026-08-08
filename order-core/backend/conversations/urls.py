from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ConversationEscalateView,
    ConversationMessagesView,
    ConversationViewSet,
    MyConversationView,
)

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    # Antes que router.urls: "mine" no debe matchear conversations/<pk>/.
    path("conversations/mine/", MyConversationView.as_view(), name="conversation-mine"),
    path("conversations/mine/messages/", ConversationMessagesView.as_view(), name="conversation-mine-messages"),
    path("conversations/mine/escalar/", ConversationEscalateView.as_view(), name="conversation-mine-escalar"),
] + router.urls
