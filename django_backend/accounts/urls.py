from django.urls import path
from accounts.views import (
    SignUpAPIView, LoginAPIView, LogoutAPIView, MeAPIView, DeleteAuthAPIView, ProfileDetailAPIView
)

urlpatterns = [
    path('auth/signup', SignUpAPIView.as_view(), name='signup'),
    path('auth/login', LoginAPIView.as_view(), name='login'),
    path('auth/logout', LogoutAPIView.as_view(), name='logout'),
    path('auth/me', MeAPIView.as_view(), name='me'),
    path('auth', DeleteAuthAPIView.as_view(), name='delete-auth'),
    path('user/profile', ProfileDetailAPIView.as_view(), name='profile-detail'),
    path('profile/', ProfileDetailAPIView.as_view()),  # 하위 호환용 임시 경로
]
