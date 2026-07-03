"""
역할: 내부 AI FastAPI 서버의 앱 진입점입니다.
흐름: uvicorn -> main.app -> app_routers -> profile/simulate/announcement/chat router.
이전 파일: django_backend/strategy/services.py, 다음 파일: Backend/app/routers/app_routers.py.
"""
from fastapi import FastAPI
from app.routers.app_routers import router

app = FastAPI(title="청약 전략 서비스")

app.include_router(router)
