"""
역할: /api/announcement 요청을 공고문 입력 후 상세 진단 재개 함수에 연결합니다.
흐름: announcement router -> process_announcement -> resume_with_announcement.
"""
from src.pipeline import resume_with_announcement


def process_announcement(session_id: str, announcement_text: str) -> dict:
    """
    공고문 텍스트를 받아 Node 4 재개 후 Node 5~6 실행.
    상세 리포트 반환.
    """
    result = resume_with_announcement(session_id, announcement_text)
    return result
