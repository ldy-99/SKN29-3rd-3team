# 수정 기록 (Fix Log)

이 문서는 코드 리뷰에서 발견된 문제를 하나씩 수정하면서, 왜 고쳤는지와 어떤 문제를 해결했는지 기록합니다.

---

## Fix 1. 세션이 FastAPI 프로세스 메모리에만 저장되던 문제

### 문제
`Backend/src/pipeline.py`와 `Backend/src/rag/chat_graph.py`의 LangGraph 체크포인터가 `MemorySaver()`(프로세스 메모리)를 사용했습니다. FastAPI 서버가 재시작되면(코드 변경으로 인한 auto-reload 포함) 진행 중이던 모든 세션(대화/진단 진행 상태)이 사라집니다.

### 수정 내용
- `MemorySaver` → `SqliteSaver`로 교체.
- `Backend/src/pipeline.py`: `Backend/src/checkpoints/pipeline_sessions.sqlite3` 파일에 세션 저장.
- `Backend/src/rag/chat_graph.py`: `Backend/src/checkpoints/chat_sessions.sqlite3` 파일에 세션 저장.
- `requirements.txt`에 `langgraph-checkpoint-sqlite==3.1.0` 추가.
- `.gitignore`에 `Backend/src/checkpoints/` 추가 (런타임 전용 로컬 데이터라 커밋 대상 아님).

### 효과 및 남은 주의사항
- 서버 재시작 후에도 세션이 유지됩니다 (파일 기반이므로).
- 여러 프로세스(예: 여러 워커)가 동시에 같은 sqlite 파일에 접근하면 잠금 경합이 생길 수 있습니다. 현재는 단일 프로세스 실행을 전제로 합니다.
- venv에 `langgraph-checkpoint-sqlite` 패키지를 새로 설치해야 합니다: `pip install -r requirements.txt`.

---

## Fix 2. Node4~6 및 RAG 도구에서 LLM 호출 실패 시 폴백 부족

### 문제
`node4`(공고문 구조화 추출), `node5`(전략 수립 에이전트), `node6`(리포트 생성), `rag_tools._rag_answer`(챗봇 답변 생성)에서 LLM 호출이 실패하면(OpenAI API 오류, 타임아웃, rate limit 등) 예외가 그대로 전파되어 전체 파이프라인이 500 에러로 끝나거나, 세션이 오류 상태로 멈췄습니다.

### 수정 내용
- `Backend/src/engine/llm_safety.py` 신규 생성: `safe_llm_call(fn, node_name, max_retries=1, retry_delay_seconds=1.5)` — 지정 횟수만큼 재시도 후에도 실패하면 `LLMCallError`를 발생시키는 공용 래퍼.
- `node4.py`: 구조화 추출 호출을 `safe_llm_call`로 감싸고, 실패 시 빈 공고 정보 + `node4_warning` 메시지를 반환(파이프라인은 계속 진행).
- `node5.py`: 지역 우선순위 체크, 에이전트 호출을 각각 안전하게 감싸고, 실패 시 `_build_fallback_agent_result()`(LLM 없이 재무 계산 결과만으로 구성한 텍스트 요약)로 대체 + `node5_agent_warning` 반환.
- `node6.py`: 리포트 생성 체인을 `safe_llm_call`로 감싸고, 실패 시 `_build_fallback_simple_summary()`(추천 공급유형 순위만으로 구성한 텍스트)로 대체 + `report["warning"]` 설정.
- `rag_tools.py`: `_rag_answer()`의 최종 답변 합성 LLM 호출을 `safe_llm_call`로 감싸고, 실패 시 이미 검색된 `sources`는 유지한 채 "AI 답변 생성 중 오류" 안내 메시지로 대체.
- `pipeline.py`: `PipelineState`에 `node4_warning`, `node5_agent_warning` 필드 추가. `resume_pipeline`/`resume_with_announcement`에도 예기치 못한 예외에 대한 최상위 안전망(`_build_error_response`)을 추가해, 어떤 경우든 사용자에게는 500 대신 정돈된 에러 메시지가 내려가도록 함.
- `_build_resume_response()`가 각 노드의 warning들을 모아 응답의 `warnings` 리스트로 포함.

### 효과 및 남은 주의사항
- LLM 호출이 일시적으로 실패해도 파이프라인이 끝까지 진행되어, 사용자는 "일부 정보가 부족합니다" 같은 경고와 함께 계산 가능한 결과라도 받아볼 수 있습니다.
- 완전히 실패하는 경우는 여전히 명확한 에러 메시지로 응답합니다(무한 재시도는 하지 않음, `max_retries=1` 기본값).
- `chat_graph.py` 내부 노드(`classify_query`, `retrieve`, `generate_rag`, `web_search`, `general_answer`)에는 아직 `safe_llm_call`을 적용하지 않았습니다 (요청 시 추가 가능).

---

## Fix 3. 챗봇 초기화가 서버 전체를 막는 문제

### 문제
`Backend/app/services/chat_service.py`가 모듈 최상단에서 `rag_app = build_chat_graph()`를 즉시 호출했습니다. `build_chat_graph()`는 ChromaDB 연결과 임베딩 초기화를 포함하므로, 이 과정에서 예외가 발생하면(예: ChromaDB 인덱스 미생성, `OPENAI_API_KEY` 누락) FastAPI 앱 전체가 시작조차 되지 않았습니다. 즉, 챗봇 기능과 무관한 진단 API(`/api/profile`, `/api/strategy` 등)까지 전부 사용할 수 없게 됩니다.

### 수정 내용
- 모듈 최상단의 즉시 초기화를 제거하고, `_get_rag_app()`이라는 지연 초기화(lazy init) 함수로 교체. 챗봇 API가 실제로 처음 호출될 때만 `build_chat_graph()`를 실행합니다.
- 초기화 실패 시 `ChatbotUnavailableError`를 발생시키고(실패를 캐싱하지 않아 다음 호출에서 재시도 가능), `chat_router.py`에서 이를 잡아 HTTP 503으로 변환.

### 효과 및 남은 주의사항
- 챗봇 초기화가 실패해도 서버는 정상적으로 뜨고, 진단 관련 API는 영향받지 않습니다.
- 챗봇 API를 처음 호출한 사용자만 초기화 지연(첫 호출 시 ChromaDB 로딩 시간)을 경험합니다. 이후 호출부터는 캐시된 인스턴스를 재사용합니다.

---

## Fix 4. Node5의 ReAct 에이전트 루프로 인한 응답 지연 문제

### 문제
"최종 전략 수립" 단계(`node5.py`)가 `create_react_agent`(ReAct 루프)를 사용해, LLM이 도구 호출 여부를 스스로 판단하고 매번 LLM 왕복을 거쳐 도구를 하나씩 호출했습니다. 이 구조는 도구 호출 순서/개수가 매번 달라질 수 있고, LLM ↔ 도구 왕복이 여러 번 발생해 전체 응답 시간이 길어지는 원인이었습니다.

### 수정 내용
- `create_react_agent` 관련 import와 에이전트 루프를 제거.
- `compare_supply_strategy`, `calculate_winning_probability`, `analyze_subscription_timing` 세 도구를 정해진 순서로 직접(순차) 호출.
- 세 도구의 결과와 Fix1(STEP1)에서 계산된 재무 데이터를 모두 하나의 `synthesis_prompt`에 미리 계산된 사실로 담아, LLM은 "도구를 호출할지 판단"하지 않고 "주어진 사실을 바탕으로 최종 전략 텍스트를 한 번에 작성"하는 역할만 수행하도록 변경.
- 결과적으로 LLM 호출 횟수가 (ReAct 루프의 가변적인 여러 번) → (합성 프롬프트 1번)으로 줄어듦.
- 이 최종 LLM 호출도 Fix 2의 `safe_llm_call`로 감싸고, 실패 시 `_build_fallback_agent_result()`로 대체.

### 효과 및 남은 주의사항
- "최종 전략 수립" 응답 시간이 크게 단축됩니다 (LLM 왕복 횟수 감소가 핵심 원인이었음 — 세션 저장 방식이나 폴백 로직과는 별개의 문제였습니다).
- 도구 호출 순서/내용이 고정되어 결과 재현성이 높아졌습니다 (기존 ReAct 방식은 매번 다를 수 있었음).
- 프롬프트에 포함되는 데이터가 많아져 프롬프트 길이는 다소 늘었지만, LLM 호출 자체는 1회이므로 순증가한 지연은 미미합니다.

---

## Fix 5. "상세 확인 사항"(확인 필요한 항목)이 항상 빈 값으로 나오던 문제

### 문제
결과 상세 페이지(`ResultDetail.tsx`)에서 "분석 결과"는 정상 표시되지만 "확인 필요한 항목"(상세 확인 사항)은 항상 비어 있었습니다.

**원인 1 (프론트엔드):** `ResultDetail.tsx`가 실제로는 존재하지 않는 필드명(`missing_fields`, `key_findings`, `recommendations`, `summary`, `message` 등)을 읽고 있었고, 백엔드(FastAPI `node2.py`)가 실제로 내려주는 필드명은 `missing_items`, `description`, `action_items` 등이었습니다.

### 수정 내용 (1차 - 프론트엔드)
- `normalizeSupplyRank()`: `missing_fields` → `missing_items ?? missing_fields`로 우선순위 변경.
- `collectAnalysisItems()`: `riskResult?.description`, `riskResult?.action_items`를 후보로 추가.

### 추가 발견: Django serializer에도 같은 이름 불일치가 있었음

프론트엔드만 고쳤는데도 여전히 비어 있어서 확인해보니, `django_backend/strategy/serializers.py`의 `StrategyRunSerializer.to_representation()`이 FastAPI의 원본 응답(raw payload)을 그대로 내려주지 않고, `supply_rank`/`missing_fields_by_supply_type` 등을 **재가공(re-derive)**해서 내려주고 있었습니다. 이 재가공 로직도 잘못된 키 이름(`missing_fields`)으로 원본 데이터(`missing_items`)를 읽고 있어서, 항상 빈 배열을 만들어 프론트엔드로 보내고 있었습니다. 프론트엔드의 `??` 폴백 체인에서 이 (잘못 재가공된, 하지만 존재는 하는) Django 값이 원본 FastAPI 페이로드보다 먼저 선택되었기 때문에, 프론트엔드만 고쳐서는 문제가 해결되지 않았습니다.

### 수정 내용 (2차 - Django serializer)
`django_backend/strategy/serializers.py`에서 4곳을 수정 (`item.get('missing_fields', ...)` → `item.get('missing_items') or item.get('missing_fields') or []`):
1. `has_missing` 계산 (전체 분석 상태 PARTIAL/COMPLETE 판단용)
2. `recommended_supply_types` 매핑
3. `supply_rank` 매핑
4. `missing_fields_by_supply_type` 매핑

`strategy/tests.py`에는 이 필드들에 대한 assertion이 없어 기존 테스트에 영향 없음을 확인.

### 효과 및 남은 주의사항
- "확인 필요한 항목"이 정상적으로 표시됩니다.
- Django 개발 서버(`runserver`)를 재시작해야 이 변경사항이 반영됩니다.

---

## Fix 6. 미혼인데 신혼부부 특공이 추천되던 문제

### 문제
`Backend/src/engine/node1.py`의 `_is_newlywed_candidate()`가 `marriage_period_years`(혼인 기간, 숫자)를 `marital_status`(혼인 상태)보다 먼저 확인했습니다. 그래서 `marital_status="SINGLE"`(미혼)이면서 `marriage_period_years=0`(실수로 또는 기본값으로 입력된 값)인 경우, `0 <= 7`이 `True`가 되어 신혼부부 특공 대상으로 잘못 분류되었습니다.

### 수정 내용
- `NOT_MARRIED_VALUES` 집합 추가 (`SINGLE`/`미혼`, `DIVORCED`/`이혼`, `WIDOWED`/`사별` 등).
- `_is_newlywed_candidate()` 맨 앞에서 `marital_status`가 `NOT_MARRIED_VALUES`에 해당하면 다른 필드 값과 무관하게 즉시 `False`를 반환하도록 변경. 이후에만 기존의 `marriage_period`/`marriage_period_years` 판단 로직이 실행됩니다.

### 효과 및 남은 주의사항
- 미혼/이혼/사별로 명시된 사용자는 혼인 기간 필드 값에 관계없이 신혼부부 특공 대상에서 제외됩니다.
- (참고, 미적용) 프론트엔드 `Profile.tsx`에서 `marital_status`가 미혼/이혼/사별일 때 "혼인 기간" 입력 필드 자체를 숨기거나 비활성화하면 이런 종류의 입력 실수를 원천 차단할 수 있습니다 — 아직 요청받지 않아 미적용.

---

## 아직 해결되지 않은 별도 이슈 (참고)

- `/api/profile`에서 간헐적으로 발생하는 10초 타임아웃: 재현 조건 불명확, 근본 원인 미확인. 재발 시 상세 로그로 추가 조사 필요.
- 회원가입 400 에러 시 표시되는 오류 메시지가 실제 원인(비밀번호가 이메일과 유사함)과 무관하게 일반적인 문구로 나오는 문제 (`django_backend/common/exceptions.py`의 fallback 메시지 버그). 별도 요청 시 수정 가능.
