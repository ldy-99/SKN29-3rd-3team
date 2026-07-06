"""
역할: Django가 전달한 프로필을 받아 LangGraph Node 1~2까지 실행합니다.
흐름: Django FastAPIClient.send_profile -> /api/profile -> profile_service -> pipeline.
"""
from fastapi import APIRouter
from app.schemas.profile_schema import UserInput
from app.services.profile_service import process_profile

router = APIRouter()


@router.post("/profile")
def submit_profile(user_input: UserInput):
    return process_profile(user_input)
