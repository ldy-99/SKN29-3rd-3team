"""
역할: FastAPI 하위 router를 하나의 router로 묶습니다.
흐름: Backend/main.py -> app_routers -> health/profile/simulate/announcement/chat/pdf.
"""
from fastapi import APIRouter
from app.routers import health, profile, chat_router, simulate_router, announcement_router, pdf_router

router = APIRouter()

router.include_router(health.router, tags=["Health"])
router.include_router(profile.router, prefix="/api", tags=["Profile"])
router.include_router(chat_router.router, prefix="/api", tags=["Chat"])
router.include_router(simulate_router.router, prefix="/api", tags=["Simulate"])
router.include_router(announcement_router.router, prefix="/api", tags=["Announcement"])
router.include_router(pdf_router.router, prefix="/api", tags=["PDF"])
