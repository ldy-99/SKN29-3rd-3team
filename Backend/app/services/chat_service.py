"""
역할: /api/chat 요청을 RAG chat graph에 연결하고 답변/출처/session_id를 반환합니다.
흐름: chat router -> get_chat_answer -> src/rag/chat_graph.py.
"""
import uuid
import sys
from pathlib import Path

# src/rag/chat_graph.py 경로 설정
RAG_DIR = Path(__file__).resolve().parents[2] / "src" / "rag"
sys.path.insert(0, str(RAG_DIR))

from chat_graph import build_chat_graph
from langchain_core.messages import HumanMessage

# ── RAG 그래프 초기화 (앱 시작 시 한 번만) ────────────────────────
# MemorySaver가 내부적으로 히스토리 관리하므로 session_store 불필요
rag_app = build_chat_graph()


def get_chat_answer(question: str, session_id: str | None) -> dict:
    """
    사용자 질문을 받아 RAG 기반 답변을 생성합니다.
    MemorySaver가 thread_id 기반으로 대화 히스토리를 내부적으로 관리합니다.

    Args:
        question: 사용자 질문
        session_id: 기존 세션 ID (없으면 새로 발급)

    Returns:
        dict: {
            "answer": 답변 텍스트,
            "sources": 출처 목록,
            "session_id": 세션 ID,
        }
    """
    # 세션 ID 발급 또는 유지
    if not session_id:
        session_id = str(uuid.uuid4())

    # MemorySaver는 thread_id로 대화 히스토리 관리
    config = {"configurable": {"thread_id": session_id}}

    # RAG 그래프 실행
    result = rag_app.invoke(
        {"messages": [HumanMessage(content=question)]},
        config=config
    )

    # 마지막 메시지가 AI 답변
    answer = result["messages"][-1].content
    sources = [s["label"] for s in result.get("sources", [])]

    return {
        "answer": answer,
        "sources": sources,
        "session_id": session_id,
    }
