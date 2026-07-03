"""
역할: Node 2 이후 사용자의 상세 진단 여부를 받아 파이프라인을 재개합니다.
흐름: Django trigger_simulate -> /api/simulate -> simulate_service -> pipeline.resume_pipeline.
"""
from fastapi import APIRouter
from app.schemas.simulate_schema import SimulateRequest
from app.services.simulate_service import process_simulate

router = APIRouter()


@router.post("/simulate")
def simulate(request: SimulateRequest):
    result = process_simulate(request.session_id, request.simulate)
    return result
