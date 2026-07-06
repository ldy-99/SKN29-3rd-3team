# 수정 기록 (Fix Log)

이 문서는 코드 리뷰에서 발견된 문제를 하나씩 수정하면서, 왜 고쳤고 무엇이 바뀌었는지 기록합니다.
팀의 공식 `docs/traces/CHANGELOG.md`와는 별도로, "왜 이렇게 고쳤는지"에 초점을 맞춘 작업 로그입니다.

---

## Fix 1. 세션이 FastAPI 프로세스 메모리에만 저장되던 문제

### 문제
`Backend/src/pipeline.py`의 전략 진단 파이프라인과 `Backend/src/rag/chat_graph.py`의 챗봇이
각각 LangGraph `MemorySaver()`를 세션 저장소로 썼습니다. `MemorySaver`는 파이썬 프로세스의 RAM에만
데이터를 들고 있어서 아래 상황에서 세션이 그냥 사라졌습니다.

- `uvicorn --reload`로 코드 변경 후 자동 재시작되면, Node2(공고문 입력 대기) 등에서 멈춰있던
  세션이 전부 유실됨. React가 들고 있는 `session_id`로 다음 요청(`/api/simulate`, `/api/announcement`)을
  보내도 서버가 그 세션을 모름.
- 챗봇 대화 이력도 같은 이유로 서버 재시작 시 전부 초기화됨.
- 프로세스가 여러 개(멀티 워커)로 뜨면 세션이 서로 다른 프로세스 메모리에 있어 어긋날 수 있음.

### 수정 내용
`MemorySaver()`를 `langgraph.checkpoint.sqlite.SqliteSaver`로 교체해서 세션을 SQLite 파일에 저장하도록
바꿨습니다. Django가 이미 SQLite(`db.sqlite3`)를 쓰고 있어서, 별도 인프라(Redis 등) 없이 로컬 개발
환경에 자연스럽게 맞는 방식을 선택했습니다.

- `requirements.txt`: `langgraph-checkpoint-sqlite==3.1.0` 추가 (기존 `langgraph==1.2.2`,
  `langgraph-checkpoint` 계열과 버전 호환 확인됨: `langgraph-checkpoint<5.0.0,>=4.1.0` 요구사항 충족).
- `Backend/src/pipeline.py`:
  - `from langgraph.checkpoint.memory import MemorySaver` → `from langgraph.checkpoint.sqlite import SqliteSaver`
  - 전략 진단 세션을 `Backend/src/checkpoints/pipeline_sessions.sqlite3` 파일에 저장.
- `Backend/src/rag/chat_graph.py`:
  - 동일하게 `SqliteSaver`로 교체.
  - 챗봇 대화 세션은 별도 파일 `Backend/src/checkpoints/chat_sessions.sqlite3`에 저장(전략 진단
    세션과 섞이지 않도록 분리).
- `.gitignore`: `Backend/src/checkpoints/`를 추가해서 세션 파일이 커밋되지 않도록 함
  (Django의 `db.sqlite3`를 이미 같은 방식으로 무시하고 있음).

### 효과 / 남은 주의사항
- 이제 `uvicorn --reload`로 서버가 재시작돼도 진행 중이던 세션과 챗봇 대화 이력이 SQLite 파일에
  남아있어서 이어서 동작합니다.
- 새 패키지를 추가했으므로, 이미 가상환경을 만들어둔 사람은 반드시
  `pip install -r requirements.txt` (또는 `requirements-dev.txt`)를 다시 실행해야 합니다.
- `SqliteSaver`는 공식 문서에도 "가볍고 단일 프로세스용"이라고 명시되어 있습니다. 지금 로컬 개발
  구조(uvicorn 단일 프로세스)에는 맞지만, 나중에 운영 환경에서 여러 워커/여러 서버로 확장한다면
  이 SQLite 파일 하나로는 부족하고 Redis 등 별도 저장소가 필요합니다. 지금은 "로컬 개발에서 재시작해도
  세션이 안 날아가게" 하는 목적에 맞춘 최소 수정입니다.
- 세션 만료(오래된 세션 자동 삭제) 로직은 아직 없습니다. 필요하면 별도로 다뤄야 합니다.

---

## Fix 2. Node4~6 LLM 실패 시 폴백이 없던 문제

### 문제
`Backend/src/engine/node4.py`(공고문 구조화 추출), `node5.py`(ReAct agent 전략 분석),
`node6.py`(리포트 요약), 그리고 이 둘이 쓰는 `Backend/src/engine/tools/rag_tools.py`의
`_rag_answer()`까지 — OpenAI 호출 부분에 `try/except`가 전혀 없었습니다. 그래서:

- API 레이트리밋, 일시적 네트워크 오류, 응답 형식 오류 등 한 번이라도 실패하면 예외가
  그대로 위로 전파되어 파이프라인 전체가 중단됨.
- Node5까지 재무 계산(대출/실투자금/리스크)이 이미 다 끝나 있어도, 마지막 ReAct agent
  호출 하나가 실패하면 그 계산 결과까지 통째로 날아감.
- FastAPI가 처리 안 된 예외로 500을 반환하면 Django가 이를 `FastAPIConnectionError`(502)로
  감싸서 React에 전달하지만, 사용자에게는 "AI 분석 서버 응답이 지연되고 있습니다" 같은
  모호한 메시지만 보이고 실제로 어느 단계가 왜 실패했는지 알 수 없었음.

### 수정 내용
- **신규 `Backend/src/engine/llm_safety.py`**: 공용 헬퍼 `safe_llm_call()`과 `LLMCallError`
  추가. LLM 호출을 감싸서 실패 시 1회 재시도(1.5초 대기 후) 하고, 그래도 실패하면
  `LLMCallError`를 던져서 호출부가 폴백을 만들 수 있게 함.
- **`node4.py`**: `structured_llm.invoke()`를 `safe_llm_call`로 감쌈. 최종 실패 시 공고
  정보를 빈 값(region=None 등)으로 채운 뒤 `node4_warning` 메시지와 함께 그래프를 계속
  진행시킴(예외를 다시 던지지 않음).
- **`node5.py`**:
  - `check_regional_priority` 툴 호출 자체를 try/except로 감싸서, 도구가 예기치 못하게
    실패해도 지역명 문자열 비교만으로 만든 폴백 결과를 사용하도록 함.
  - ReAct `agent.invoke()`를 `safe_llm_call`로 감쌈. 실패 시 STEP1에서 이미 계산해둔
    대출/실투자금/리스크/지역우선공급 결과를 그대로 활용해 **LLM 없이** 만든 대체 요약
    (`_build_fallback_agent_result`)을 `agent_result`로 사용. `node5_agent_warning`도 함께 반환.
- **`node6.py`**: 간단 리포트의 `_simple_report_chain.invoke()`를 `safe_llm_call`로 감쌈.
  실패 시 GPT 요약 없이 원본 데이터(추천 공급 유형, 특공 순위)만으로 만든 대체 요약
  (`_build_fallback_simple_summary`)을 사용하고, 응답에 `report["warning"]`을 추가.
- **`rag_tools.py`**: `_rag_answer()`의 검색(`retriever.search`)만 감싸져 있고 정작 답변
  생성 LLM 호출(`chain.invoke`)은 안 감싸져 있던 걸 발견해서 같이 고침. 실패해도 이미
  검색된 출처(sources)는 남겨서 반환.
- **`pipeline.py`**:
  - `resume_pipeline`/`resume_with_announcement`의 `pipeline.stream()` 호출을 try/except로
    한 번 더 감싸서, 각 node가 스스로 못 잡은 예상 밖의 예외(버그 등)까지 대비하는 최후의
    안전망(`_build_error_response`) 추가. 이 경우 500 대신 `{"status": "error", ...}` 형태로
    일관되게 응답.
  - `_build_resume_response()`가 `node4_warning`/`node5_agent_warning`을 모아서 응답의
    `warnings` 배열에 실어 보내도록 함. (프론트는 아직 이 필드를 안 쓰고 있어서, 화면에
    바로 보이진 않음 — 필요하면 프론트 연동은 별도로 진행해야 함.)

### 효과 / 남은 주의사항
- 이제 node4~6의 LLM 호출 중 하나가 실패해도 파이프라인이 통째로 죽지 않고, 이미 계산된
  결과를 최대한 살려서 "참고용" 결과 + 경고 메시지를 돌려줍니다. 완전 실패(500)가
  "저하된 성공"으로 바뀐 셈입니다.
- 재시도는 1회, 1.5초 대기로 고정해뒀습니다. 레이트리밋이 심하면 이 정도로는 부족할 수
  있어서, 필요하면 `safe_llm_call`의 `max_retries`/`retry_delay_seconds`를 조정하면 됩니다.
- `warnings` 필드는 API 응답에만 추가했고, `frontend-react` 쪽에서 이 필드를 읽어서
  사용자에게 보여주는 처리는 아직 안 되어 있습니다. 화면에 "이 결과는 일부 실패로 인한
  참고용입니다" 같은 배너를 띄우고 싶다면 프론트 작업이 추가로 필요합니다.
- 코드 리뷰 중 발견한 별개 이슈: `node6.py`는 `gpt-5.4-nano` 모델을 쓰는데 `node4.py`,
  `node5.py`는 `gpt-4o-mini`를 씁니다. 의도된 건지 확인이 필요해서 이번 수정에서는
  건드리지 않았습니다.

---

## Fix 3. 챗봇 초기화가 서버 전체를 막던 문제

### 문제
`Backend/app/services/chat_service.py`가 모듈 최상단(import 시점)에서 바로
`rag_app = build_chat_graph()`를 실행하고 있었습니다. 이 한 줄이 실행되는 순간
`chat_graph.py`가 import되고, 그 안의 `from retriever import search, format_source`가
`retriever.py`의 모듈 최상단 코드(`chromadb.PersistentClient(...)`,
`OpenAIEmbeddingFunction(...)`)까지 즉시 실행시킵니다.

문제는 이 import 체인이 서버가 켜지기도 전에 일어난다는 것입니다:
`main.py` → `app_routers.py`의 `from app.routers import health, profile, chat_router, ...`
한 줄이 `health`부터 `pdf_router`까지 전부 한 번에 import합니다. 그래서 ChromaDB가
아직 안 만들어졌거나(신규 clone 직후), 경로 문제, OpenAI 키 문제 등으로
`chat_router` import가 실패하면 이 import 문 전체가 실패하고, `main.py`의
`app = FastAPI(...)`조차 만들어지지 못해서 **챗봇과 전혀 상관없는
`/health`, `/api/profile`, `/api/simulate` 같은 엔드포인트까지 서버 자체가 안 떴습니다.**

### 수정 내용
- **`chat_service.py`**: 모듈 최상단에서 하던 `build_chat_graph()` 호출과
  `from chat_graph import build_chat_graph` import를 전부 `_get_rag_app()` 함수 안으로
  옮겨서 지연 초기화로 바꿈.
  - 첫 `/api/chat` 요청이 들어올 때만 실제로 `chat_graph.py`(및 `retriever.py`의
    ChromaDB 연결)를 import/생성함.
  - 성공하면 `_rag_app`에 캐시해서 이후 요청은 재사용, 실패하면 예외를 캐시하지 않고
    다음 요청에서 다시 시도(그 사이 ChromaDB를 빌드했다면 다음 요청은 성공할 수 있음).
  - 실패 시 `ChatbotUnavailableError`를 던져서 "무엇이 왜 실패했는지" 알 수 있는
    메시지를 전달.
- **`chat_router.py`**: `ChatbotUnavailableError`를 잡아서 FastAPI `HTTPException(503)`으로
  변환. 이제 챗봇 관련 의존성이 깨져 있어도 `/api/chat` 요청 하나만 503으로 실패하고,
  서버 기동과 다른 엔드포인트는 전혀 영향받지 않음.

### 효과 / 남은 주의사항
- ChromaDB를 아직 안 만든 상태로 서버를 켜도 이제 `/health`, `/api/profile`,
  `/api/simulate`, `/api/announcement`, `/api/pdf/analyze`는 정상적으로 뜹니다.
  `/api/chat`만 첫 호출 시 503과 함께 원인 힌트(ChromaDB/OPENAI_API_KEY 확인)를 줍니다.
- Django `FastAPIClient.call_chatbot`은 `response.raise_for_status()`로 503을 잡아서
  `FastAPIConnectionError`로 변환하는데, `requests`의 `HTTPError` 메시지에는 FastAPI가
  보낸 상세 `detail` 문구가 그대로 담기지 않고 "503 Server Error: ..." 정도로만
  나옵니다. 더 친절한 메시지를 원하면 Django `services.py`에서 응답 body를 파싱해서
  `detail`을 꺼내오는 작업이 추가로 필요합니다(이번 수정 범위 밖).
- `chat_graph.py` 내부의 개별 노드(`classify_query`, `retrieve`, `generate_rag`,
  `web_search`, `general_answer`)는 여전히 각자 LLM을 직접 호출하고 있고, Fix 2에서
  다룬 `safe_llm_call` 폴백은 적용하지 않았습니다. 초기화 문제와는 별개로, 대화 도중
  LLM 호출 하나가 실패하는 경우까지 다루려면 Fix 2와 같은 패턴을 chat_graph.py에도
  적용하는 추가 작업이 필요합니다.

---

## Fix 4. 최종 전략 수립(상세 진단)이 오래 걸리던 문제

### 문제
`node4`(공고문 추출) → `node5`(전략 분석) → `node6`(리포트 생성)으로 이어지는 상세
진단 경로 하나에서 OpenAI 호출이 순차적으로 7~8회 정도 걸리고 있었습니다. 특히
`node5.py`의 STEP2가 `create_react_agent`로 3개 도구(`compare_supply_strategy`,
`calculate_winning_probability`, `analyze_subscription_timing`)를 LLM이 스스로
판단해서 순서대로 호출하게 하고 있었는데, 실제로는:

- `compare_supply_strategy`, `calculate_winning_probability`는 LLM 호출이 전혀 없는
  순수 계산 함수(파이썬 함수, 즉시 실행)였고,
- 어떤 도구를 어떤 인자로 어떤 순서로 부를지가 프롬프트에 이미 전부 고정되어
  있었습니다(자유 판단의 여지가 없음).

그런데도 ReAct agent 구조를 쓰고 있어서 도구 하나 호출할 때마다 "다음에 뭘 할지"를
LLM에게 다시 물어보는 왕복이 발생했고(도구 3개 + 최종 답변까지 총 4~5회 LLM 왕복),
그중 `analyze_subscription_timing`은 내부적으로 RAG 검색 + LLM 답변 생성까지 하므로
그 안에서 LLM 호출이 한 번 더 걸렸습니다. 결과적으로 정말 필요한 LLM 호출은
1~2번인데, ReAct 루프의 "도구 선택" 오버헤드 때문에 3~4번의 불필요한 왕복이
추가되고 있었습니다.

### 수정 내용
`node5.py`의 STEP2를 다음과 같이 바꿨습니다.

- `create_react_agent`와 `mock_tools` 구성을 제거.
- `compare_supply_strategy`, `calculate_winning_probability`,
  `analyze_subscription_timing`을 **코드에서 직접 순서대로 호출**(`.invoke(...)`)하도록
  변경. 이 호출은 네트워크 왕복이 필요한 LLM 판단 없이 바로 실행됨(앞의 두 개는
  즉시 실행되는 계산 함수이고, 세 번째는 RAG+LLM 호출이 그 안에 딱 1번만 있음).
- 도구 3개의 결과(`compare_result`, `probability_result`, `timing_result`)를 모두
  모아서, 이 결과를 사용자에게 설명하는 문장으로 정리하는 **LLM 호출을 딱 1번**만
  수행하도록 변경(`synthesis_prompt` + `llm.invoke(...)`, `safe_llm_call`로 감싸서
  Fix 2와 동일하게 실패 시 폴백).
- 기존 프롬프트에 있던 모든 스타일/톤 규칙(당첨 확률 표시 규칙, 자격 확정 여부 구분,
  자금 리스크별 결론 작성 규칙 등)은 그대로 유지하고, "도구를 호출해서 알아내라"는
  지시만 "이미 계산된 아래 데이터를 그대로 사용해서 설명하라"는 지시로 바꿨습니다.
- 도구 직접 호출 자체가 실패하는 경우(버그 등 예기치 못한 예외)에도 대비해
  try/except로 감싸고, 실패하면 Fix 2에서 만든 `_build_fallback_agent_result`로
  폴백하도록 함.

### 효과 / 남은 주의사항
- 상세 진단 경로의 OpenAI 순차 호출 횟수가 대략 7~8회 → 4회 안팎으로 줄었습니다
  (node4 추출 1회 + node5의 `check_regional_priority` RAG 답변 1회 +
  `analyze_subscription_timing` RAG 답변 1회 + node5 최종 종합 1회 + node6 리포트
  요약 1회). ReAct 루프에서 순수하게 "도구 선택"만 하던 3~4번의 LLM 호출이 사라진
  것이 핵심입니다.
- 실제 체감 단축 폭은 OpenAI 응답 속도에 따라 다르지만, 이전 대비 상세 진단
  전체 소요 시간이 눈에 띄게 줄어들 것으로 예상됩니다. 정확한 수치는 실제로
  돌려보면서 확인이 필요합니다(로그에 STEP1/STEP2 타이밍을 찍어보는 것을 권장).
- 이 변경으로 LLM이 "결과를 설명하는" 역할만 하게 됐고 "무엇을 계산할지 판단"하는
  역할은 없앴습니다. 원래 이 판단이 실제로 자유로웠던 게 아니라 프롬프트로 고정돼
  있었기 때문에 동작/출력 형식은 기존과 동일해야 하지만, 문구가 미세하게 달라질
  수 있으니 실제 결과물을 몇 건 비교해보는 걸 권장합니다.
- `chat_graph.py`의 챗봇 대화 흐름(질문 분류 → 검색 → 답변 생성)은 이번 수정
  대상이 아닙니다. 챗봇도 매 질문마다 분류(1) + 검색어 압축(1) + 답변 생성(1) 해서
  최소 3회 LLM 호출이 걸리는 구조인데, 필요하면 별도로 다뤄야 합니다.

---

## Fix 5. 결과 화면의 "상세 확인 사항"이 항상 비어 보이던 문제

이건 Fix 1~4와 무관하게, 실제로 서버를 띄워 회원가입부터 진단까지 테스트하는 과정에서
발견한 별개의 기존 버그입니다.

### 문제
`frontend-react/src/app/pages/ResultDetail.tsx`가 결과 화면의 "분석 결과" /
"확인 필요한 항목" 섹션을 채울 때 읽는 필드 이름이 실제 백엔드 응답과 달랐습니다.

- **확인 필요한 항목**: 프론트는 각 공급유형 항목에서 `item.missing_fields`를
  읽었는데, `Backend/src/engine/node2.py`가 실제로 만드는 필드 이름은
  `missing_items`였습니다. 그래서 "신혼부부 특공은 혼인/자녀 기준 미확인" 같은
  실제 데이터가 응답에 들어있어도 프론트는 항상 빈 배열로 처리해 "추가 확인 항목이
  없습니다"만 보여줬습니다.
- **분석 결과**: 프론트는 `report.key_findings` / `report.recommendations` /
  `report.warnings`와 `node5.risk_result.summary`(또는 `.message`)를 찾았는데,
  `node6.py`의 리포트 생성 함수도 `financial.py`의 `analyze_financial_risk`도
  이런 이름의 필드를 만든 적이 없습니다. 실제로 존재하는 필드는
  `risk_result.description`(리스크 설명 문장)과 `risk_result.action_items`
  (행동지침 목록)이었습니다.

즉 프론트가 원래 기대했던 응답 모양과 백엔드가 실제로 주는 응답 모양이 애초에
어긋나 있던, 프론트-백엔드 계약 불일치 버그였습니다.

### 수정 내용
`ResultDetail.tsx`만 수정(백엔드 필드 이름이 실제 계산 로직과 자연스럽게 맞아떨어지는
쪽이라 프론트를 백엔드에 맞춤):

- `normalizeSupplyRank()`: `item.missing_fields` 대신 `item.missing_items`를
  읽도록 수정(`missing_items ?? missing_fields`로 둘 다 지원해 향후 다른 경로에서
  `missing_fields`를 쓰더라도 깨지지 않게 함).
- `collectAnalysisItems()`: 존재하지 않는 `summary`/`message` 대신 실제로 존재하는
  `risk_result.description`과 `risk_result.action_items`를 후보로 추가.

### 효과 / 남은 주의사항
- 상세 진단(공고문 입력 경로) 결과에서 이제 "확인 필요한 항목"에 실제 미확인 항목이,
  "분석 결과"에 자금 리스크 설명과 행동지침이 표시됩니다.
- "공고 없이 기본 조건만 확인"(simple report) 경로는 애초에 `node5`가 실행되지
  않아 `risk_result`가 없으므로, 이 경로에서는 "분석 결과"가 비어 보이는 게 정상입니다.
  이 경로까지 채우고 싶다면 `node6.py`의 `_build_simple_report()`가 별도의
  분석 항목을 만들어 반환하도록 추가 작업이 필요합니다.
- 근본적으로는 백엔드 응답 스키마와 프론트 타입이 문서화되어 있지 않아 생긴
  문제라, `docs/current/API_CONTRACT.md`에 이 필드들(`missing_items`, `risk_result.description`,
  `risk_result.action_items` 등)을 명시해두면 앞으로 같은 종류의 불일치를 줄일 수
  있습니다.

### 추가 발견: Django serializer에도 같은 이름 불일치가 있었음
실제로 서버를 띄워 확인해보니, 위 프론트 수정만으로는 "확인 필요한 항목"이 여전히
안 떴습니다. 원인은 한 겹 더 있었습니다: `django_backend/strategy/serializers.py`의
`StrategyRunSerializer.to_representation()`이 FastAPI 원본 응답(`result_payload`)을
그대로 내려주는 게 아니라 자체적으로 `supply_rank`, `missing_fields_by_supply_type`,
`recommended_supply_types`를 다시 만들어서 내려주는데, 이때도 `item.get('missing_fields')`로
읽고 있어서 (FastAPI가 보내는 실제 키는 `missing_items`) 이 Django가 재가공한 값이
**항상 빈 배열**이었습니다. 그리고 프론트의 `buildResultViewModel()`은
`result?.supply_rank ?? payload.supply_rank`처럼 Django가 재가공한 값을 원본
FastAPI 값보다 우선해서 쓰고 있어서, 프론트만 고쳐서는 여전히 Django가 만든
빈 배열을 보고 있었던 것입니다.

`serializers.py`에서 `item.get('missing_items') or item.get('missing_fields') or []`
형태로 고쳐서, 실제 키(`missing_items`)를 우선 읽고 없으면 예전 이름(`missing_fields`)도
호환되도록 했습니다. 수정한 위치: `overall_analysis_status` 계산(has_missing),
`recommended_supply_types`, `supply_rank`, `missing_fields_by_supply_type` 4곳.

이 부분까지 고친 뒤에는 Django를 거친 응답에서도 `missing_fields_by_supply_type`과
`supply_rank[].missing_fields`가 실제 값으로 채워지고, `overall_analysis_status`도
미확인 항목이 있으면 `PARTIAL`로 정확히 표시됩니다. **Django 개발 서버(`runserver`)는
재시작해야 이 변경이 반영됩니다.**

---

## Fix 6. 미혼인데 신혼부부 특공이 추천되던 문제

이것도 테스트 중 발견한, Fix 1~5와는 무관한 별개의 로직 버그입니다.

### 문제
`Backend/src/engine/node1.py`의 `_is_newlywed_candidate()`가 신혼부부 특공 후보
여부를 판단할 때 아래 순서로 확인했습니다.

1. `marriage_period`("WITHIN_7_YEARS"/"OVER_7_YEARS")
2. `marriage_period_years`(숫자, 7 이하면 True)
3. `marital_status`(MARRIED/ENGAGED 등이면 True) — **마지막에만** 확인

문제는 프로필 화면에서 "혼인 기간(년)" 입력란이 미혼인 사용자에게도 그냥 숫자
입력칸으로 남아있어서, 사용자가 실수로(또는 습관적으로) `0`을 입력하면
`marriage_period_years=0`이 저장되고, `marital_status=SINGLE`(미혼)임에도
2번 조건(`0 <= 7`)이 먼저 걸려 `True`를 반환 — 신혼부부 특공 후보로 잘못
분류되고 있었습니다. `marital_status`를 확인하는 3번 조건까지 로직이 도달하지도
못했습니다.

### 수정 내용
`_is_newlywed_candidate()` 맨 앞에 `marital_status` 게이트를 추가했습니다.
`marital_status`가 `SINGLE`/`DIVORCED`/`WIDOWED`(및 한글 표기 미혼/이혼/사별)로
명확하면, `marriage_period`나 `marriage_period_years` 값과 상관없이 즉시
`False`(신혼부부 특공 대상 아님)를 반환하도록 했습니다. `marital_status`가
비어있거나 기혼/예비신혼 계열이면 기존 로직(marriage_period → marriage_period_years
→ marital_status 순서)을 그대로 따릅니다.

### 효과 / 남은 주의사항
- 미혼 사용자가 혼인 기간에 실수로 0(또는 다른 숫자)을 입력해도 더 이상 신혼부부
  특공이 추천되지 않습니다.
- 근본적으로는 프론트(`Profile.tsx`)에서 "혼인 상태"가 미혼/이혼/사별일 때
  "혼인 기간" 입력란을 아예 숨기거나 비활성화하면 이런 모순된 입력 자체를 막을 수
  있습니다. 이번 수정은 백엔드 판단 로직만 방어적으로 고친 것이라, 원하면 프론트
  UX 개선도 추가로 진행할 수 있습니다.
- 같은 종류의 "지금 있는 필드값이 다른 필드와 모순될 수 있다" 문제가 다자녀
  특공(`_is_multi_child_candidate`)이나 생애최초 특공(`_is_first_home_candidate`)
  판단 로직에도 있을 수 있어, 비슷한 이상 추천을 보게 되면 알려주세요.
