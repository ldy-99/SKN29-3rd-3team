"""
역할: RAG 챗봇 질문을 받아 답변과 출처를 반환합니다.
흐름: Django call_chatbot -> /api/chat -> chat_service -> src/rag/chat_graph.py.
"""
from fastapi import APIRouter, HTTPException
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.chat_service import ChatbotUnavailableError, get_chat_answer

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    try:
        result = get_chat_answer(request.question, request.session_id)
    except ChatbotUnavailableError as exc:
        # 챗봇 초기화 실패(ChromaDB 미구축, OpenAI 키 문제 등)는 이 엔드포인트만
        # 503으로 응답하고, health/profile/simulate 등 다른 엔드포인트에는 영향을 주지 않음.
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return ChatResponse(
        answer=result["answer"],
        sources=result["sources"],
        session_id=result["session_id"],
    )
