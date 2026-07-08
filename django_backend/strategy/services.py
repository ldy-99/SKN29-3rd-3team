"""
역할: Django에서 내부 FastAPI AI API를 호출하는 HTTP client입니다.
흐름: strategy.views -> FastAPIClient -> Backend /api/profile, /api/simulate, /api/announcement, /api/chat.
주의: PDF proxy는 원본 파일을 저장하지 않고 FastAPI 추출 endpoint에 일회성으로 전달합니다.
"""
import requests
from django.conf import settings
from rest_framework.exceptions import APIException
import logging

logger = logging.getLogger(__name__)

class FastAPIConnectionError(APIException):
    status_code = 502
    default_detail = '내부 AI 분석 서버와의 통신에 실패했습니다.'
    default_code = 'FASTAPI_CONNECTION_FAILED'


class FastAPITimeoutError(APIException):
    status_code = 504
    default_detail = '내부 AI 분석 서버 응답 시간이 초과되었습니다.'
    default_code = 'FASTAPI_TIMEOUT'


class FastAPIUpstreamError(APIException):
    status_code = 502
    default_detail = '내부 AI 분석 서버가 요청을 정상 처리하지 못했습니다.'
    default_code = 'FASTAPI_UPSTREAM_ERROR'


class FastAPIClient:
    def __init__(self):
        self.base_url = getattr(settings, 'FASTAPI_API_URL', 'http://127.0.0.1:8080')
        self.profile_timeout = getattr(settings, 'FASTAPI_PROFILE_TIMEOUT', 10)
        self.simulate_timeout = getattr(settings, 'FASTAPI_SIMULATE_TIMEOUT', 30)
        self.chatbot_timeout = getattr(settings, 'FASTAPI_CHATBOT_TIMEOUT', 30)
        self.announcement_timeout = getattr(settings, 'FASTAPI_ANNOUNCEMENT_TIMEOUT', 90)
        self.pdf_timeout = getattr(settings, 'FASTAPI_PDF_TIMEOUT', 90)

    def send_profile(self, profile_data: dict) -> dict:
        """
        FastAPI의 POST /api/profile 엔드포인트 호출
        """
        url = f"{self.base_url}/api/profile"
        payload = {"profile": profile_data}
        try:
            response = requests.post(url, json=payload, timeout=self.profile_timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            logger.error(f"FastAPI send_profile timeout after {self.profile_timeout}s: {e}")
            raise FastAPITimeoutError()
        except requests.exceptions.HTTPError as e:
            logger.error(f"FastAPI send_profile upstream error: {e}")
            raise FastAPIUpstreamError()
        except requests.RequestException as e:
            logger.error(f"FastAPI send_profile error: {e}")
            raise FastAPIConnectionError()

    def send_announcement(self, session_id: str, announcement_text: str) -> dict:
        """
        FastAPI의 POST /api/announcement 엔드포인트 호출
        """
        url = f"{self.base_url}/api/announcement"
        payload = {
            "session_id": session_id,
            "announcement_text": announcement_text
        }
        try:
            response = requests.post(url, json=payload, timeout=self.announcement_timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            logger.error(f"FastAPI send_announcement timeout after {self.announcement_timeout}s: {e}")
            raise FastAPITimeoutError()
        except requests.exceptions.HTTPError as e:
            logger.error(f"FastAPI send_announcement upstream error: {e}")
            raise FastAPIUpstreamError()
        except requests.RequestException as e:
            logger.error(f"FastAPI send_announcement error: {e}")
            raise FastAPIConnectionError()

    def trigger_simulate(self, session_id: str, simulate: bool = True) -> dict:
        """
        FastAPI의 POST /api/simulate 엔드포인트 호출
        """
        url = f"{self.base_url}/api/simulate"
        payload = {
            "session_id": session_id,
            "simulate": simulate
        }
        try:
            response = requests.post(url, json=payload, timeout=self.simulate_timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            logger.error(f"FastAPI trigger_simulate timeout after {self.simulate_timeout}s: {e}")
            raise FastAPITimeoutError()
        except requests.exceptions.HTTPError as e:
            logger.error(f"FastAPI trigger_simulate upstream error: {e}")
            raise FastAPIUpstreamError()
        except requests.RequestException as e:
            logger.error(f"FastAPI trigger_simulate error: {e}")
            raise FastAPIConnectionError()

    def run_diagnosis(self, session_id: str, profile_3rd: dict, announcement_text: str = None) -> dict:
        """
        프로필 전송 ➡️ (필요 시) 공고문 전송 ➡️ 진단 실행(simulate) 일괄 수행
        """
        # 1. 프로필 전송. FastAPI/LangGraph가 발급한 session_id를 이후 호출에 사용합니다.
        profile_result = self.send_profile(profile_3rd)
        fastapi_session_id = profile_result.get("session_id") or session_id

        # 2. 공고문이 있으면 상세 진단 분기로 먼저 이동한 뒤 공고문을 전달합니다.
        if announcement_text:
            self.trigger_simulate(fastapi_session_id, simulate=True)
            return self.send_announcement(fastapi_session_id, announcement_text)
        else:
            return self.trigger_simulate(fastapi_session_id, simulate=False)

    def proxy_pdf_analysis(self, file_name: str, file_content: bytes) -> dict:
        """
        FastAPI의 POST /api/pdf/analyze 엔드포인트로 PDF 파일 바이너리를 멀티파트로 전송
        """
        url = f"{self.base_url}/api/pdf/analyze"
        files = {'file': (file_name, file_content, 'application/pdf')}
        try:
            response = requests.post(url, files=files, timeout=self.pdf_timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            logger.error(f"FastAPI proxy_pdf_analysis timeout after {self.pdf_timeout}s: {e}")
            raise FastAPITimeoutError()
        except requests.exceptions.HTTPError as e:
            logger.error(f"FastAPI proxy_pdf_analysis upstream error: {e}")
            raise FastAPIUpstreamError()
        except requests.RequestException as e:
            logger.error(f"FastAPI proxy_pdf_analysis error: {e}")
            raise FastAPIConnectionError()

    def call_chatbot(self, question: str, session_id: str = None) -> dict:
        """
        FastAPI의 POST /api/chat 엔드포인트로 질문 및 세션 전송 (타임아웃 30초)
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "question": question,
            "session_id": session_id
        }
        try:
            response = requests.post(url, json=payload, timeout=self.chatbot_timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout as e:
            logger.error(f"FastAPI call_chatbot timeout after {self.chatbot_timeout}s: {e}")
            raise FastAPITimeoutError()
        except requests.exceptions.HTTPError as e:
            logger.error(f"FastAPI call_chatbot upstream error: {e}")
            raise FastAPIUpstreamError()
        except requests.RequestException as e:
            logger.error(f"FastAPI call_chatbot error: {e}")
            raise FastAPIConnectionError()

