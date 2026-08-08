from django.urls import path

from .views import KnowledgeSearchView

urlpatterns = [
    path("knowledge/search/", KnowledgeSearchView.as_view(), name="knowledge-search"),
]
