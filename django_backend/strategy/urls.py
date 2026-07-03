"""
역할: 전략 진단, 공고, PDF, 챗봇 API 경로를 strategy view에 연결합니다.
흐름: config.urls /api/* -> strategy.urls -> Strategy/PDF/Chatbot views.
"""
from django.urls import path
from strategy.views import (
    StrategyRunAPIView, StrategyDetailAPIView, PDFAnalyzeAPIView, AnnouncementInputAPIView, ChatbotAPIView
)

urlpatterns = [
    path('strategy', StrategyRunAPIView.as_view(), name='strategy-run'),
    path('strategy/me', StrategyRunAPIView.as_view(), name='strategy-list'),
    path('strategy/<uuid:strategy_id>', StrategyDetailAPIView.as_view(), name='strategy-detail'),
    path('pdf/analyze', PDFAnalyzeAPIView.as_view(), name='pdf-analyze'),
    path('user/announcement', AnnouncementInputAPIView.as_view(), name='announcement-create'),
    path('user/announcement/<uuid:announcement_id>', AnnouncementInputAPIView.as_view(), name='announcement-detail'),
    path('chatbot', ChatbotAPIView.as_view(), name='chatbot'),
]
