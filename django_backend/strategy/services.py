import requests
from django.conf import settings
from rest_framework.exceptions import APIException
import logging

logger = logging.getLogger(__name__)

class FastAPIConnectionError(APIException):
    status_code = 502
    default_detail = '내부 AI 분석 서버와의 통신에 실패했습니다.'
    default_code = 'FASTAPI_CONNECTION_FAILED'


class FastAPIClient:
    def __init__(self):
        self.base_url = getattr(settings, 'FASTAPI_API_URL', 'http://127.0.0.1:8080')

    def send_profile(self, profile_data: dict) -> dict:
        """
        FastAPI의 POST /api/profile 엔드포인트 호출
        """
        url = f"{self.base_url}/api/profile"
        payload = {"profile": profile_data}
        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"FastAPI send_profile error: {e}")
            raise FastAPIConnectionError(f"프로필 데이터 전송 실패: {str(e)}")

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
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"FastAPI send_announcement error: {e}")
            raise FastAPIConnectionError(f"공고문 데이터 전송 실패: {str(e)}")

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
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"FastAPI trigger_simulate error: {e}")
            raise FastAPIConnectionError(f"청약 진단 시뮬레이션 연산 실패: {str(e)}")

    def run_diagnosis(self, session_id: str, profile_3rd: dict, announcement_text: str = None) -> dict:
        """
        프로필 전송 ➡️ (필요 시) 공고문 전송 ➡️ 진단 실행(simulate) 일괄 수행
        """
        # 1. 프로필 전송
        self.send_profile(profile_3rd)
        
        # 2. 공고문이 있을 경우 공고문 전송
        if announcement_text:
            self.send_announcement(session_id, announcement_text)
            simulate_flag = True
        else:
            simulate_flag = False

        # 3. 진단 실행
        result = self.trigger_simulate(session_id, simulate=simulate_flag)
        return result

    def proxy_pdf_analysis(self, file_name: str, file_content: bytes) -> dict:
        """
        FastAPI의 POST /api/pdf/analyze 엔드포인트로 PDF 파일 바이너리를 멀티파트로 전송
        """
        url = f"{self.base_url}/api/pdf/analyze"
        files = {'file': (file_name, file_content, 'application/pdf')}
        try:
            response = requests.post(url, files=files, timeout=90)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"FastAPI proxy_pdf_analysis error: {e}")
            raise FastAPIConnectionError(f"PDF 파일 분석 프록시 전송 실패: {str(e)}")

    def call_chatbot(self, question: str, session_id: str = None) -> dict:
        """
        FastAPI의 POST /api/chat 엔드포인트로 질문 및 세션 전송 (타임아웃 45초)
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "question": question,
            "session_id": session_id
        }
        try:
            response = requests.post(url, json=payload, timeout=45)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"FastAPI call_chatbot error: {e}")
            raise FastAPIConnectionError(f"챗봇 서비스 호출에 실패했습니다: {str(e)}")
