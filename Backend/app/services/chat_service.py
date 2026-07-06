"""
역할: /api/chat 요청을 RAG chat graph에 연결하고 답변/출처/session_id를 반환합니다.
흐름: chat router -> get_chat_answer -> src/rag/chat_graph.py.

주의: 챗봇 그래프 초기화(ChromaDB PersistentClient, OpenAI 임베딩 함수 등 생성)는
예전엔 이 모듈이 import되는 순간(=서버 기동 시) 바로 실행됐습니다. 그래서 ChromaDB가
아직 빌드되지 않았거나 설정에 문제가 있으면 이 import 자체가 실패했고, main.py가
app_routers 전체를 한 번에 import하는 구조라 챗봇과 무관한 health/profile/simulate
등 다른 엔드포인트까지 서버가 통째로 안 뜨는 문제가 있었습니다.
지금은 첫 /api/chat 요청이 들어올 때만 지연 초기화(_get_rag_app)하도록 바꿔서,
챗봇 초기화가 실패해도 그 요청만 실패하고 서버 자체와 다른 엔드포인트는 영향을
받지 않습니다.
"""
import uuid
import sys
from pathlib import Path

from langchain_core.messages import HumanMessage

# src/rag/chat_graph.py 경로 설정
RAG_DIR = Path(__file__).resolve().parents[2] / "src" / "rag"
sys.path.insert(0, str(RAG_DIR))


class ChatbotUnavailableError(RuntimeError):
    """챗봇 그래프 초기화(ChromaDB/OpenAI 연결 등)에 실패했을 때 발생시키는 예외.

    chat_router가 이 예외를 잡아서 503으로 변환하는 것을 전제로 합니다.
    """


_rag_app = None  # 첫 성공 이후로는 프로세스 생존 기간 동안 캐시됨


def _get_rag_app():
    """RAG 그래프를 첫 요청 시점에 지연 생성합니다.

    - chat_graph.py의 import(및 그 안에서 일어나는 retriever.py의 ChromaDB 연결)를
      이 함수 안으로 옮겨서, 모듈 최상단이 아니라 실제로 챗봇을 쓸 때만 실행되게 함.
    - 실패하면 여기서 매번 다시 시도합니다(초기화 비용이 크지 않고, 그 사이에
      ChromaDB를 새로 빌드했거나 .env를 고쳤다면 다음 요청에서 성공할 수 있음).
    - 성공하면 이후 요청들은 캐시된 그래프를 그대로 재사용합니다.
    """
    global _rag_app

    if _rag_app is not None:
        return _rag_app

    try:
        from chat_graph import build_chat_graph
        _rag_app = build_chat_graph()
        return _rag_app
    except Exception as exc:
        print(f"[chat_service] 챗봇 그래프 초기화 실패: {type(exc).__name__}: {exc}")
        raise ChatbotUnavailableError(
            "챗봇 기능을 초기화하지 못했습니다. ChromaDB가 빌드되어 있는지"
            "(Backend/src/preprocessing/build_all.py), OPENAI_API_KEY가 올바른지 확인해주세요."
        ) from exc


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
    # 챗봇 그래프 지연 초기화 (실패 시 ChatbotUnavailableError -> 라우터에서 503 처리)
    rag_app = _get_rag_app()

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
