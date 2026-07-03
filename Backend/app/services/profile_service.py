"""
역할: /api/profile 요청을 LangGraph 파이프라인 시작 함수에 연결합니다.
흐름: profile router -> process_profile -> run_pipeline_until_node2.
"""
from app.schemas.profile_schema import UserInput
from src.pipeline import run_pipeline_until_node2


def process_profile(user_input: UserInput) -> dict:
    """
    사용자 프로필을 받아 Node 1~2 실행 후 인터럽트.
    supply_rank와 session_id를 반환합니다.
    """
    profile = user_input.profile.model_dump()
    result = run_pipeline_until_node2(profile)
    return result
