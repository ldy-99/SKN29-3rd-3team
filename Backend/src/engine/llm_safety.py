"""공용 LLM 호출 안전장치.

Node4~6과 rag_tools에서 OpenAI 호출(구조화 추출, ReAct agent, 리포트 생성 등)이
실패했을 때(레이트리밋, 타임아웃, 네트워크 오류, 잘못된 응답 등) 그대로 예외가
위로 전파되어 파이프라인 전체가 끊기는 문제를 막기 위한 유틸리티입니다.

사용 패턴:
    try:
        result = safe_llm_call(lambda: chain.invoke(...), node_name="node6_simple_report")
    except LLMCallError as exc:
        # 여기서 폴백 값을 만들어서 그래프를 계속 진행시킴 (예외를 다시 던지지 않음)
        result = build_fallback(...)
"""

from __future__ import annotations

import time
from typing import Callable, Optional, TypeVar

T = TypeVar("T")


class LLMCallError(RuntimeError):
    """모든 재시도 후에도 LLM 호출이 실패했을 때 발생시키는 예외.

    이 예외는 각 node 내부에서 잡아서 폴백 값을 반환하는 용도로만 쓰고,
    FastAPI 응답까지 그대로 올려보내지 않는 것을 전제로 합니다.
    """

    def __init__(self, node_name: str, message: str, original: Optional[Exception] = None):
        super().__init__(message)
        self.node_name = node_name
        self.message = message
        self.original = original


def safe_llm_call(
    fn: Callable[[], T],
    *,
    node_name: str,
    max_retries: int = 1,
    retry_delay_seconds: float = 1.5,
) -> T:
    """`fn()`을 호출하고 실패하면 `max_retries`번 재시도합니다.

    - 레이트리밋/일시적 네트워크 오류처럼 재시도하면 성공할 수 있는 경우를 위해
      짧은 대기 후 1회 더 시도합니다(기본값).
    - 모든 시도가 실패하면 `LLMCallError`를 발생시킵니다. 호출부(각 node)에서
      이 예외를 잡아 그래프를 멈추지 않고 폴백 값을 반환해야 합니다.
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as exc:  # OpenAI API 오류, 네트워크 오류 등을 포괄적으로 처리
            last_error = exc
            print(
                f"[{node_name}] LLM 호출 실패 (시도 {attempt + 1}/{max_retries + 1}): "
                f"{type(exc).__name__}: {exc}"
            )
            if attempt < max_retries:
                time.sleep(retry_delay_seconds)

    raise LLMCallError(
        node_name,
        f"{node_name} 단계에서 AI 응답 생성에 실패했습니다.",
        original=last_error,
    )
