"""
역할: React에서 호출하는 인증과 프로필 공개 API를 처리합니다.
흐름: React client.ts -> accounts.views -> serializers/models -> 공통 envelope 응답.
다음 파일: django_backend/accounts/serializers.py, django_backend/accounts/models.py.
"""
from django.contrib.auth import login, logout, get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import NotFound
from accounts.models import Profile
from accounts.serializers import (
    ProfileSerializer, UserSerializer, SignUpSerializer, LoginSerializer
)
from accounts.permissions import IsOwner

User = get_user_model()

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle

class SignUpRateThrottle(AnonRateThrottle):
    rate = '10/min'  # IP당 분당 최대 10회 가입 시도 제한


class LoginRateThrottle(SimpleRateThrottle):
    scope = 'login'
    rate = '10/min'  # IP당 분당 최대 10회 로그인 시도 제한

    def get_cache_key(self, request, view):
        # 로그인 상태와 관계없이 IP 주소 기준으로 스로틀링 수행
        return f"throttle_{self.scope}_{self.get_ident(request)}"


class SignUpAPIView(APIView):
    """
    회원가입 API.
    성공 시 즉시 자동 로그인(세션 쿠키 발급) 처리됩니다.
    """
    permission_classes = [AllowAny]
    throttle_classes = [SignUpRateThrottle]

    def post(self, request):
        serializer = SignUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # 즉시 자동 로그인 처리
        login(request, user)

        user_serializer = UserSerializer(user)
        return Response(user_serializer.data, status=status.HTTP_201_CREATED)


class LoginAPIView(APIView):
    """
    로그인 API.
    세션 쿠키를 브라우저에 발행합니다.
    """
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        login(request, user)

        user_serializer = UserSerializer(user)
        return Response(user_serializer.data, status=status.HTTP_200_OK)


class LogoutAPIView(APIView):
    """
    로그아웃 API.
    세션 쿠키를 무효화합니다.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"message": "로그아웃되었습니다."}, status=status.HTTP_200_OK)


class MeAPIView(APIView):
    """
    현재 로그인된 사용자 조회 API.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DeleteAuthAPIView(APIView):
    """
    계정 탈퇴 API.
    유저 데이터를 삭제하고 세션을 만료시킵니다.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        logout(request)
        user.delete()
        return Response({"message": "계정이 성공적으로 삭제되었습니다."}, status=status.HTTP_200_OK)


class ProfileDetailAPIView(APIView):
    """
    현재 로그인된 유저의 청약 프로필 조회 및 생성/수정(Upsert) API.
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def get_object(self, request):
        try:
            profile = request.user.profile
            # 객체 수준 권한 검사 (IsOwner)
            self.check_object_permissions(request, profile)
            return profile
        except Profile.DoesNotExist:
            raise NotFound("프로필이 존재하지 않습니다.")

    def get(self, request):
        profile = self.get_object(request)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def post(self, request):
        # 3차 테스트 호환 및 편의를 위한 기존 POST Upsert
        try:
            profile = request.user.profile
            self.check_object_permissions(request, profile)
            serializer = ProfileSerializer(profile, data=request.data, partial=True)
        except Profile.DoesNotExist:
            serializer = ProfileSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        # 전체 덮어쓰기 (Upsert)
        try:
            profile = request.user.profile
            self.check_object_permissions(request, profile)
            serializer = ProfileSerializer(profile, data=request.data, partial=False)
        except Profile.DoesNotExist:
            serializer = ProfileSerializer(data=request.data, partial=False)

        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        # 부분 업데이트
        profile = self.get_object(request)
        serializer = ProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
