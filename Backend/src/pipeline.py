"""
청약 전략 서비스 파이프라인
Node 1 → Node 2 → [인터럽트] → Node 3 → Node 4 → Node 5 → Node 6
"""

from __future__ import annotations

import sqlite3
import uuid
from pathlib import Path
from typing import Any
from typing_extensions import TypedDict

from langgraph.graph import StateGraph, END, START
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command

from src.engine.node1 import run_node1
from src.engine.node2 import node2_recommend_supply
from src.engine.node3 import run_node3, route_node3
from src.engine.node4 import run_node4
from src.engine.node5 import run_node5
from src.engine.node6 import run_node6


# ── 파이프라인 State 정의 ─────────────────────────────────────────

class PipelineState(TypedDict, total=False):
    # 프로필
    profile: dict

    # Node 1 결과
    available_supply_types: list
    tool_inputs: dict
    node1_warnings: list

    # Node 2 결과
    supply_analysis: dict
    supply_rank: list
    recommended_supply: str

    # Node 3 분기
    wants_detailed_diagnosis: str

    # Node 4 결과
    announcement: dict
    node4_warning: str

    # Node 5 결과
    loan_result: dict
    investment_result: dict
    risk_result: dict
    agent_result: str
    node5_agent_warning: str

    # Node 6 결과
    final_report: dict


# ── 세션 저장소 (SQLite 기반) ─────────────────────────────────────
# 기존 MemorySaver()는 프로세스 메모리에만 세션을 저장해서
# uvicorn --reload로 프로세스가 재시작되면 진행 중이던 세션(Node2 인터럽트 대기 등)이
# 전부 사라졌음. SQLite 파일로 옮겨 재시작 후에도 세션이 유지되도록 함.
_CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
_CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
_CHECKPOINT_DB_PATH = _CHECKPOINT_DIR / "pipeline_sessions.sqlite3"

# check_same_thread=False: FastAPI가 요청을 스레드풀에서 처리하므로 필요.
# SqliteSaver 내부적으로 lock을 사용해 동시 접근을 직렬화함.
_sqlite_conn = sqlite3.connect(str(_CHECKPOINT_DB_PATH), check_same_thread=False)
memory = SqliteSaver(_sqlite_conn)


# ── 파이프라인 그래프 빌드 ────────────────────────────────────────

def _build_pipeline():
    graph = StateGraph(PipelineState)

    graph.add_node("node1", run_node1)
    graph.add_node("node2", node2_recommend_supply)
    graph.add_node("node3", run_node3)
    graph.add_node("node4", run_node4)
    graph.add_node("node5", run_node5)
    graph.add_node("node6", run_node6)

    graph.add_edge(START, "node1")
    graph.add_edge("node1", "node2")
    graph.add_edge("node2", "node3")

    graph.add_conditional_edges(
        "node3",
        route_node3,
        {
            "node4": "node4",
            "node6": "node6",
        }
    )

    graph.add_edge("node4", "node5")
    graph.add_edge("node5", "node6")
    graph.add_edge("node6", END)

    return graph.compile(
        checkpointer=memory,
        interrupt_after=["node2"],
    )

pipeline = _build_pipeline()


# ── 외부 호출 함수 ────────────────────────────────────────────────

def run_pipeline_until_node2(profile: dict[str, Any]) -> dict[str, Any]:
    """Node 1~2 실행 후 인터럽트. supply_rank와 session_id 반환."""
    session_id = str(uuid.uuid4())
    config = {"configurable": {"thread_id": session_id}}
    initial_state = {"profile": profile}

    for event in pipeline.stream(initial_state, config, stream_mode="values"):
        print(f"[DEBUG] keys: {event.keys()}")
        print(f"[DEBUG] tool_inputs: {event.get('tool_inputs')}")
        print(f"[DEBUG] available_supply_types: {event.get('available_supply_types')}")

    state = pipeline.get_state(config)

    return {
        "session_id": session_id,
        "supply_rank": state.values.get("supply_rank", []),
        "recommended_supply": state.values.get("recommended_supply", "일반공급"),
    }


def resume_pipeline(session_id: str, simulate: bool) -> dict[str, Any]:
    """Node 2 인터럽트 해제. simulate O/X에 따라 분기."""
    config = {"configurable": {"thread_id": session_id}}

    pipeline.update_state(
        config,
        {"wants_detailed_diagnosis": "예" if simulate else "아니오"},
    )

    try:
        for _ in pipeline.stream(None, config, stream_mode="values"):
            pass
    except Exception as exc:  # 안전망: node 내부에서 못 잡은 예기치 못한 예외
        return _build_error_response(session_id, exc)

    state = pipeline.get_state(config)

    if state.next and "node4" in state.next:
        return {
            "status": "waiting",
            "session_id": session_id,
            "message": "공고문 정보를 입력해주세요.",
        }

    return _build_resume_response("success", session_id, state.values)


def resume_with_announcement(session_id: str, announcement_text: str) -> dict[str, Any]:
    """Node 4 인터럽트 해제. 공고문 입력 후 Node 5~6 실행."""
    config = {"configurable": {"thread_id": session_id}}

    try:
        for _ in pipeline.stream(
            Command(resume=announcement_text),
            config,
            stream_mode="values"
        ):
            pass
    except Exception as exc:  # 안전망: node 내부에서 못 잡은 예기치 못한 예외
        return _build_error_response(session_id, exc)

    state = pipeline.get_state(config)

    return _build_resume_response("success", session_id, state.values)


def _build_error_response(session_id: str, exc: Exception) -> dict[str, Any]:
    """node1~6 어디에서든 각 노드가 스스로 못 잡은 예외가 새어나왔을 때 쓰는 최후의 안전망.

    node4~6은 각자 LLM 호출을 안전하게 감싸서 실패해도 폴백 값을 반환하도록
    되어있지만(llm_safety.safe_llm_call), 그 밖의 버그나 예상 못한 예외까지 대비해
    여기서 한 번 더 잡아서 500 대신 일관된 에러 응답을 돌려준다.
    """
    print(f"[pipeline] 처리되지 않은 예외 발생 (session_id={session_id}): {type(exc).__name__}: {exc}")
    return {
        "status": "error",
        "session_id": session_id,
        "message": "전략 진단 처리 중 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    }


def _build_resume_response(status: str, session_id: str, values: dict[str, Any]) -> dict[str, Any]:
    """Return the final graph state in an API-friendly shape for the frontend."""
    node5 = {
        "loan_result": values.get("loan_result", {}),
        "investment_result": values.get("investment_result", {}),
        "risk_result": values.get("risk_result", {}),
        "agent_result": values.get("agent_result", ""),
    }

    # node4~6에서 LLM 폴백이 발동됐다면 남겨둔 warning들을 한 곳에 모아서 응답에 포함.
    # 프론트가 아직 이 필드를 안 쓰더라도, API 응답에는 실패 사실이 남아있게 해서
    # 조용히 이상한 결과만 보여주고 끝나는 상황을 방지함.
    warnings = [
        w for w in [values.get("node4_warning"), values.get("node5_agent_warning")]
        if w
    ]

    return {
        "status": status,
        "session_id": session_id,
        "report": values.get("final_report", {}),
        "profile": values.get("profile", {}),
        "announcement": values.get("announcement", {}),
        "available_supply_types": values.get("available_supply_types", []),
        "supply_analysis": values.get("supply_analysis", {}),
        "supply_rank": values.get("supply_rank", []),
        "recommended_supply": values.get("recommended_supply"),
        "node5": node5,
        "node6": {"final_report": values.get("final_report", {})},
        "warnings": warnings,
    }
