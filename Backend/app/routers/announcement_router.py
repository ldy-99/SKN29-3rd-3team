"""
역할: 상세 진단 경로에서 모집공고문 텍스트를 받아 Node 4 이후를 진행합니다.
흐름: Django send_announcement -> /api/announcement -> announcement_service -> pipeline.resume_with_announcement.
"""
from fastapi import APIRouter
from app.schemas.announcement_schema import AnnouncementRequest
from app.services.announcement_service import process_announcement

router = APIRouter()


@router.post("/announcement")
def announcement(request: AnnouncementRequest):
    result = process_announcement(request.session_id, request.announcement_text)
    return result
