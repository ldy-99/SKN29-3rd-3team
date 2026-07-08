"""
역할: 전략 진단 실행/조회, PDF proxy, RAG 챗봇 proxy 공개 API를 처리합니다.
흐름: React client.ts -> strategy.views -> serializers/adapters/services/models -> FastAPI/RAG.
다음 파일: django_backend/strategy/services.py, Backend/app/routers/*.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from rest_framework.throttling import UserRateThrottle
from rest_framework.exceptions import NotFound, ValidationError
from accounts.serializers import ProfileSerializer
from accounts.permissions import IsOwner
from strategy.models import StrategyRun, AnnouncementInput
from strategy.serializers import (
    StrategyRunSerializer, StrategyRequestSerializer, AnnouncementInputSerializer, ChatbotRequestSerializer
)
from strategy.adapters import ProfileAdapter
from strategy.services import FastAPIClient
import logging
import re

logger = logging.getLogger(__name__)


def _build_announcement_display_title(
    *,
    profile_only=False,
    announcement_name=None,
    source_filename=None,
    announcement_text=None,
):
    if profile_only:
        return "청약 가능성 분석"

    for value in [announcement_name, _extract_title_from_text(announcement_text), _clean_filename_title(source_filename)]:
        title = _clean_display_title(value)
        if title:
            return title

    return "아파트 분양 공고 진단"


def _extract_title_from_text(text):
    if not text:
        return None

    for line in str(text).replace("\r", "").split("\n")[:30]:
        cleaned = _clean_display_title(line)
        if cleaned:
            return cleaned
    return None


def _clean_filename_title(filename):
    if not filename:
        return None
    cleaned = re.sub(r"\.(pdf|hwp|hwpx|docx?)$", "", str(filename), flags=re.I)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    return re.sub(r"^(공고문|입주자\s*모집공고)\s*", "", cleaned, flags=re.I)


def _clean_display_title(value):
    if not value:
        return None

    cleaned = re.sub(r"\.(pdf|hwp|hwpx|docx?)$", "", str(value), flags=re.I)
    cleaned = re.sub(r"^[\s■●ㆍ\-•]+", "", cleaned)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    cutoff_patterns = [
        r"\s*입주자\s*모집공고.*$",
        r"\s*입주자모집공고.*$",
        r"\s*분양\s*공고.*$",
        r"\s*모집공고문.*$",
        r"\s*선착순.*$",
        r"\s*잔여\s*세대.*$",
        r"\s*잔여세대.*$",
        r"\s*일반\s*매각.*$",
        r"\s*일반매각.*$",
        r"\s*미분양\s*매입.*$",
        r"\s*미분양매입.*$",
        r"\s*공고문.*$",
    ]
    for pattern in cutoff_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.I).strip()

    if len(cleaned) < 2 or len(cleaned) > 60:
        return None
    if re.search(
        r"금회|정부의|방안|마련|협조|따라|우리\s*공사|공급하는\s*주택|아파트\s*청약\s*진단용|PDF\s*공고문\s*핵심\s*요약|공고명\s*[:：]?\s*확인\s*필요",
        cleaned,
        flags=re.I,
    ):
        return None

    return cleaned

class StrategyRunAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        내 청약 진단 이력 목록 조회
        """
        runs = StrategyRun.objects.filter(user=request.user).order_by('-created_at')
        serializer = StrategyRunSerializer(runs, many=True)
        return Response(serializer.data)

    def post(self, request):
        """
        청약 진단 실행 (Post strategy)
        """
        user = request.user

        # 1. 사용자 프로필 존재 여부 확인
        try:
            profile = user.profile
        except AttributeError:
            exc = ValidationError("전략 진단에 필요한 사용자 프로필이 존재하지 않습니다.")
            exc.code = "PROFILE_REQUIRED"
            exc.message = "자가진단을 진행하기 전 프로필 정보를 먼저 등록해야 합니다."
            raise exc

        # 2. 프로필의 필수 필드가 전부 다 차있는지 검증
        profile_serializer = ProfileSerializer(profile)
        temp_serializer = ProfileSerializer(profile, data=profile_serializer.data, partial=False)
        if not temp_serializer.is_valid():
            raise ValidationError(temp_serializer.errors)

        # 3. 요청 바디 유효성 검사
        req_serializer = StrategyRequestSerializer(data=request.data)
        req_serializer.is_valid(raise_exception=True)

        announcement_data = req_serializer.validated_data.get('announcement')
        top_level_announcement_text = req_serializer.validated_data.get('announcement_text')
        profile_only = req_serializer.validated_data.get('profile_only', False)
        source_filename = req_serializer.validated_data.get('source_filename')
        pdf_extracted_fields = req_serializer.validated_data.get('pdf_extracted_fields')
        pdf_announcement_name = (
            pdf_extracted_fields.get('announcement_name')
            if isinstance(pdf_extracted_fields, dict)
            else None
        )
        announcement_instance = None
        if announcement_data:
            announcement_serializer = AnnouncementInputSerializer(data=announcement_data)
            announcement_serializer.is_valid(raise_exception=True)
            announcement_instance = announcement_serializer.save(user=user)

        # 4. StrategyRun 생성 (PENDING 상태)
        strategy_run = StrategyRun.objects.create(
            user=user,
            status='PENDING'
        )

        # 5. 입력값 스냅샷 딕셔너리 생성
        # PDF 원본은 저장하지 않고, 사용자가 확인한 정리본과 요약/구조화 메타데이터만 이력에 남깁니다.
        if announcement_instance:
            announcement_snapshot = dict(AnnouncementInputSerializer(announcement_instance).data)
            announcement_snapshot["display_title"] = _build_announcement_display_title(
                announcement_name=announcement_snapshot.get("announcement_name"),
                announcement_text=announcement_snapshot.get("announcement_text"),
            )
        else:
            announcement_snapshot = {
                "announcement_text": top_level_announcement_text,
                "display_title": _build_announcement_display_title(
                    profile_only=profile_only,
                    announcement_name=pdf_announcement_name,
                    source_filename=source_filename,
                    announcement_text=top_level_announcement_text,
                ),
                "pdf_analysis_id": req_serializer.validated_data.get('pdf_analysis_id'),
                "input_method": req_serializer.validated_data.get('input_method') or ("manual" if top_level_announcement_text else None),
                "source_filename": source_filename,
                "pdf_summary_text": req_serializer.validated_data.get('pdf_summary_text'),
                "pdf_extracted_fields": pdf_extracted_fields,
                "profile_only": profile_only,
            }

        input_snapshot = {
            "profile": profile_serializer.data,
            "announcement": announcement_snapshot,
        }
        strategy_run.input_snapshot = input_snapshot
        strategy_run.save()

        # 6. 4차 스펙 -> 3차 스펙 변환
        profile_3rd = ProfileAdapter.to_3rd_spec(profile_serializer.data)
        session_id = str(strategy_run.id)

        announcement_text = None
        if announcement_instance:
            announcement_text = announcement_instance.announcement_text or announcement_instance.announcement_name or announcement_instance.area_text
        elif top_level_announcement_text:
            announcement_text = top_level_announcement_text

        # 7. FastAPI 호출
        client = FastAPIClient()
        try:
            strategy_run.status = 'RUNNING'
            strategy_run.save()

            result = client.run_diagnosis(
                session_id=session_id,
                profile_3rd=profile_3rd,
                announcement_text=announcement_text
            )

            # 성공 시 결과 적재 및 상태 갱신
            strategy_run.transition_to('SUCCEEDED', save=False)
            strategy_run.result_payload = result
            strategy_run.save()

            return Response(StrategyRunSerializer(strategy_run).data, status=status.HTTP_201_CREATED)

        except Exception as e:
            strategy_run.transition_to('FAILED', save=False)
            strategy_run.result_payload = {"error": str(e)}
            strategy_run.save()

            logger.error(f"Strategy run {session_id} failed: {e}")
            raise e


class StrategyDetailAPIView(APIView):
    permission_classes = [IsAuthenticated, IsOwner]

    def get_object(self, strategy_id):
        try:
            run = StrategyRun.objects.get(id=strategy_id)
            self.check_object_permissions(self.request, run)
            return run
        except (StrategyRun.DoesNotExist, ValidationError):
            raise NotFound("해당 진단 기록을 찾을 수 없습니다.")

    def get(self, request, strategy_id):
        """
        내 특정 진단 기록 상세 조회
        """
        run = self.get_object(strategy_id)
        serializer = StrategyRunSerializer(run)
        return Response(serializer.data)


class PDFAnalyzeAPIView(APIView):
    """
    모집공고문 PDF 파일 수신 및 내부 FastAPI 텍스트 추출 프록시 API.
    """
    parser_classes = [MultiPartParser]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            raise ValidationError("업로드된 파일이 없습니다.")

        # 1. 파일 검증 (PDF 파일 확장자 또는 MIME)
        if not file_obj.name.lower().endswith('.pdf') and file_obj.content_type != 'application/pdf':
            exc = ValidationError("PDF 형식의 파일만 업로드할 수 있습니다.")
            exc.code = "PDF_INVALID_TYPE"
            exc.message = "PDF 파일 형식이 유효하지 않습니다."
            raise exc
        if file_obj.size > 15 * 1024 * 1024:
            exc = ValidationError("PDF 파일은 15MB 이하만 업로드할 수 있습니다.")
            exc.code = "PDF_TOO_LARGE"
            exc.message = "PDF 파일 크기가 제한을 초과했습니다."
            raise exc

        # 2. 원본 파일은 저장하지 않고 FastAPI에 일회성 추출 요청으로만 전달합니다.
        client = FastAPIClient()
        try:
            result = client.proxy_pdf_analysis(file_obj.name, file_obj.read())

            # FastAPI 응답을 받아 그대로 반환
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"PDF Analysis proxy failed: {e}")
            raise e


class AnnouncementInputAPIView(APIView):
    """
    분석 확정된 공고 정보 또는 수동 입력된 공고 정보를 검증하고 개별 저장하는 API.
    """
    permission_classes = [IsAuthenticated, IsOwner]

    def get_object(self, announcement_id):
        try:
            announcement = AnnouncementInput.objects.get(id=announcement_id)
            self.check_object_permissions(self.request, announcement)
            return announcement
        except (AnnouncementInput.DoesNotExist, ValidationError):
            raise NotFound("해당 공고 정보를 찾을 수 없습니다.")

    def get(self, request, announcement_id):
        """
        특정 공고 정보 상세 조회 (IsOwner 권한 적용)
        """
        announcement = self.get_object(announcement_id)
        serializer = AnnouncementInputSerializer(announcement)
        return Response(serializer.data)

    def post(self, request):
        """
        공고 정보 신규 생성 및 검증
        """
        serializer = AnnouncementInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ChatbotAPIView(APIView):
    """
    RAG 기반 FAQ 챗봇 질문 수신 및 내부 FastAPI AI 통신 프록시 API.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def post(self, request):
        serializer = ChatbotRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        question = serializer.validated_data.get('question')
        session_id = serializer.validated_data.get('session_id')

        client = FastAPIClient()
        try:
            result = client.call_chatbot(question, session_id)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Chatbot proxy failed: {e}")
            raise e
