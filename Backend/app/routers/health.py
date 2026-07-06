"""
역할: FastAPI 서버 상태 확인 endpoint를 제공합니다.
흐름: README health check -> /health.
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health_check():
    return {"status": "ok"}
