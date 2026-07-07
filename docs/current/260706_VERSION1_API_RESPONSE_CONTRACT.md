# version-1 API 응답 계약 및 0706 통합 로드맵

기준일: 2026-07-06  
기준 브랜치: `origin/version-1`  
기준 커밋: `5a12726`  
목적: jihun 백엔드 병합 이후 FastAPI 응답 형태와 서비스별 책임을 고정하고, Django/React 통합 작업이 같은 규격을 보도록 한다.

## 1. 현재 팀 진행 상태

| 담당 | 현재 상태 | 오늘 연결 지점 |
|---|---|---|
| 준억 | 전체 구조와 FastAPI 응답 계약 정리 담당 | 이 문서를 기준으로 Django/React 표시 필드를 고정 |
| 지훈 | 백엔드 개선사항을 `version-1`에 병합 완료 | FastAPI 실제 응답 필드와 오류 fallback 최종 확인 필요 |
| 동윤 | Django 인증·세션·저장 흐름 개선 예정 | `StrategyRunSerializer`, `FastAPIClient`, 저장 필드가 이 계약과 맞아야 함 |
| 은진 | 프론트 개선 브랜치 `eunjin/frontend` 작업 완료, 아직 미통합 | 최신 `version-1`과 병합 시 `ResultDetail.tsx` 충돌 예상 |

현재 판단:

- jihun 백엔드 개선은 `version-1`에 들어와 있으므로 오늘 API 계약의 기준으로 삼는다.
- 은진 프론트 브랜치는 jihun 병합 전 기준에서 갈라져 있어 바로 병합하지 않는다.
- 동윤 Django 개선사항이 들어온 뒤, 이 문서의 응답 계약 기준으로 프론트 통합을 진행하는 순서가 안전하다.

## 2. 서비스 책임

| 서비스 | 책임 | 하지 않는 일 |
|---|---|---|
| React | 사용자 입력, 화면 전환, 결과 표시, 챗봇 UI | FastAPI 내부 필드 직접 조립 |
| Django | 인증, 세션, 권한, 사용자 데이터 저장, FastAPI proxy, 진단 이력 저장 | LLM/RAG 판단 로직 재구현 |
| FastAPI | LangGraph 파이프라인, PDF 텍스트 추출, RAG/챗봇, 최종 진단 응답 생성 | 사용자 session cookie 관리 |
| ChromaDB | RAG 검색용 collection 저장 | Git에 포함되는 공유 DB 역할 |

원칙:

- React는 Django 공개 API만 호출한다.
- Django는 FastAPI 내부 API를 호출하고 결과를 저장/전달한다.
- FastAPI 응답 구조가 바뀌면 Django serializer와 React 결과 화면을 함께 조정한다.

## 3. 핵심 사용자 흐름

### 3.1 기본 프로필 진단

```text
React POST /api/strategy
  body: { "profile_only": true, "announcement_text": null }
-> Django StrategyRunAPIView
-> FastAPI POST /api/profile
-> FastAPI POST /api/simulate { simulate: false }
-> Django StrategyRun.result_payload 저장
-> React 결과 화면
```

### 3.2 PDF 기반 상세 진단

```text
React POST /api/pdf/analyze
-> Django PDFAnalyzeAPIView
-> FastAPI POST /api/pdf/analyze
-> FastAPI가 raw 추출문을 규칙 기반/LLM으로 정리
-> React가 diagnosis_text를 편집 가능한 공고문 정리본으로 표시
-> React POST /api/strategy
  body: {
    "announcement_text": 사용자가 확인한 diagnosis_text,
    "input_method": "pdf",
    "source_filename": "...pdf",
    "pdf_analysis_id": "uuid"
  }
-> Django POST /api/profile
-> Django POST /api/simulate { simulate: true }
-> Django POST /api/announcement
-> StrategyRun 저장
-> React 결과 화면
```

### 3.3 챗봇

```text
React POST /api/chatbot
-> Django ChatbotAPIView
-> FastAPI POST /api/chat
-> RAG chat graph 지연 초기화
-> answer/sources/session_id 반환
```

## 4. Django 공개 API 계약

모든 Django 응답은 공통 renderer를 통해 다음 envelope로 감싸진다.

성공:

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

실패:

```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자에게 보여줄 메시지",
    "field_errors": {}
  },
  "request_id": "uuid"
}
```

### 4.1 `POST /api/strategy`

요청:

```json
{
  "announcement_text": "모집공고문 텍스트 또는 사용자가 확인한 PDF diagnosis_text",
  "profile_only": false,
  "input_method": "pdf",
  "source_filename": "notice.pdf",
  "pdf_analysis_id": "uuid",
  "pdf_summary_text": "사용자 이력/확인용 짧은 요약",
  "pdf_extracted_fields": {
    "announcement_name": "공고명",
    "location": "공급 위치"
  }
}
```

기본 진단 요청:

```json
{
  "announcement_text": null,
  "profile_only": true
}
```

응답 `data` 주요 필드:

```text
id
strategy_id
status
input_snapshot
result_payload
created_at
updated_at
diagnosis_mode
overall_analysis_status
announcement_confirmed
recommended_supply
recommended_supply_types
supply_rank
missing_fields_by_supply_type
warnings
report
```

상태:

```text
PENDING | RUNNING | SUCCEEDED | FAILED
```

`diagnosis_mode`:

```text
PROFILE_ONLY | ANNOUNCEMENT_BASED
```

`overall_analysis_status`:

```text
COMPLETE | PARTIAL | FAILED | PENDING | RUNNING
```

React 결과 화면은 우선 아래 필드를 기준으로 표시한다.

| 화면 목적 | 우선 필드 |
|---|---|
| 상단 상태 | `status`, `overall_analysis_status`, `diagnosis_mode` |
| 추천 유형 | `recommended_supply` |
| 공급 유형 순위 | `supply_rank` |
| 누락/추가 확인 | `missing_fields_by_supply_type`, `recommended_supply_types[].missing_fields`, `warnings` |
| 요약 | `report.summary` |
| 상세 전략 | `report.strategy` |
| 재무 분석 | `report.finance` |
| 원본 확인 | `result_payload`, `input_snapshot` |

### 4.2 `POST /api/pdf/analyze`

요청:

```text
multipart/form-data
file: PDF, 15MB 이하
```

응답 `data`:

```json
{
  "pdf_analysis_id": "uuid",
  "extraction_status": "EXTRACTED",
  "filename": "notice.pdf",
  "page_count": 52,
  "text_length": 101550,
  "combined_text_length": 15000,
  "table_count": 101,
  "truncated": true,
  "preview": "미리보기 텍스트",
  "raw_preview": "PDF 원문 추출 일부",
  "summary_text": "사용자 이력/확인용 짧은 공고문 핵심 요약",
  "diagnosis_text": "전략 진단 입력용 구조화 공고문 정리본",
  "summary_source": "llm",
  "extracted_fields": {
    "announcement_name": "notice title",
    "location": "공급 위치",
    "housing_category": "민영주택",
    "regulated_area": "투기과열지구, 청약과열지역",
    "housing_types": [],
    "price_summary": {
      "min_krw": 1206000000,
      "max_krw": 1707000000
    }
  },
  "combined_text": "전략 진단 입력용 공고문 정리본",
  "tables": [
    {
      "page": 1,
      "rows": [["구분", "일정"]]
    }
  ],
  "warnings": []
}
```

`summary_source`는 `llm` 또는 `rule`이다. `combined_text`는 하위 호환 필드이며 현재는 `diagnosis_text`와 같은 정리본을 담는다. React는 사용자가 확인/수정한 `diagnosis_text`를 이후 `POST /api/strategy`의 `announcement_text`로 전달한다. `summary_text`와 `extracted_fields`는 PDF 기반 진단 이력 식별을 위해 `POST /api/strategy` 요청에도 함께 전달할 수 있다. PDF 원본 파일은 저장하지 않는다.

### 4.3 `POST /api/chatbot`

요청:

```json
{
  "question": "무주택 기간은 어떻게 계산하나요?",
  "session_id": null
}
```

응답 `data`:

```json
{
  "answer": "답변 텍스트",
  "sources": ["출처 label"],
  "session_id": "uuid"
}
```

FastAPI 챗봇 초기화가 실패하면 Django는 FastAPI 오류를 받아 사용자에게 실패 응답을 전달한다. jihun 병합 이후 챗봇 그래프는 첫 요청 시 지연 초기화되므로, ChromaDB/API key 문제가 FastAPI 전체 기동 실패로 번지는 범위는 줄었다.

## 5. 내부 FastAPI API 계약

이 endpoint들은 브라우저가 직접 호출하지 않는다.

### 5.1 `POST /api/profile`

요청:

```json
{
  "profile": {
    "bankbook_type": "주택청약종합저축",
    "bankbook_join_date": "2022-01-15",
    "bankbook_payments": 24,
    "bankbook_balance": 2400000,
    "region": "서울",
    "residence_period_years": 1,
    "is_homeless": true,
    "housing_ownership": false,
    "homeless_period_years": 0,
    "is_household_head": true,
    "num_household_members": 2,
    "marital_status": "SINGLE",
    "marriage_period_years": 0,
    "birth_year": 1995,
    "child_status": "NO_CHILD",
    "minor_child_count": 0,
    "child_count_group": "NONE",
    "youngest_child_age_group": "ADULT_OR_NONE",
    "is_elderly_parent": false,
    "elderly_parent_years": 0,
    "is_dual_income": null,
    "average_monthly_income": 0,
    "has_property_history": false,
    "total_assets": 0
  }
}
```

응답:

```json
{
  "session_id": "uuid",
  "supply_rank": [
    {
      "rank": 1,
      "type": "생애최초 특공",
      "score": null,
      "max_score": null,
      "ratio": null,
      "reason": "추첨제 우선 추천",
      "method": "추첨제",
      "score_breakdown": {},
      "matched_items": [],
      "missing_items": [],
      "source_refs": []
    }
  ],
  "recommended_supply": "생애최초 특공"
}
```

### 5.2 `POST /api/simulate`

요청:

```json
{
  "session_id": "uuid",
  "simulate": true
}
```

`simulate=true` 응답:

```json
{
  "status": "waiting",
  "session_id": "uuid",
  "message": "공고문 정보를 입력해주세요."
}
```

`simulate=false` 응답:

```json
{
  "status": "success",
  "session_id": "uuid",
  "report": {
    "report_type": "simple",
    "recommended_supply": "일반공급",
    "supply_rank": [],
    "summary": "요약 텍스트"
  },
  "profile": {},
  "announcement": {},
  "available_supply_types": [],
  "supply_analysis": {},
  "supply_rank": [],
  "recommended_supply": "일반공급",
  "node5": {
    "loan_result": {},
    "investment_result": {},
    "risk_result": {},
    "agent_result": ""
  },
  "node6": {
    "final_report": {}
  },
  "warnings": []
}
```

예외 안전망 응답:

```json
{
  "status": "error",
  "session_id": "uuid",
  "message": "전략 진단 처리 중 예기치 못한 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
}
```

### 5.3 `POST /api/announcement`

요청:

```json
{
  "session_id": "uuid",
  "announcement_text": "모집공고문 텍스트"
}
```

응답은 상세 진단 성공 시 `simulate=false`의 success 응답과 같은 최상위 구조를 사용하되, 다음 필드가 채워진다.

```text
report.report_type = "detailed"
announcement
node5.loan_result
node5.investment_result
node5.risk_result
node5.agent_result
warnings
```

Node 4가 공고문 구조화에 성공하면 `announcement`는 다음 내부 필드를 가진다.

```json
{
  "region": "서울 강남구",
  "is_regulated": true,
  "supply_type": "민간",
  "price": 500000000,
  "deposit": null,
  "area": "84㎡",
  "supply_count": 80
}
```

### 5.4 `POST /api/pdf/analyze`

FastAPI 직접 응답은 Django `POST /api/pdf/analyze`의 `data`와 동일하다. Django 공개 API에서는 공통 envelope로 감싸진다.

### 5.5 `POST /api/chat`

요청:

```json
{
  "question": "청약통장 납입 횟수 기준 알려줘",
  "session_id": null
}
```

응답:

```json
{
  "answer": "답변 텍스트",
  "sources": ["출처 label"],
  "session_id": "uuid"
}
```

챗봇 초기화 실패:

```json
{
  "detail": "챗봇 기능을 초기화하지 못했습니다. ChromaDB가 빌드되어 있는지(Backend/src/preprocessing/build_all.py), OPENAI_API_KEY가 올바른지 확인해주세요."
}
```

HTTP status는 503이다.

## 6. 필드 매핑 기준

### 6.1 Django 공개 프로필 → FastAPI 프로필

| Django 공개 필드 | FastAPI 내부 필드 |
|---|---|
| `bankbook_type` | `bankbook_type` |
| `bankbook_join_date` | `bankbook_join_date`, `bankbook_joined_months` |
| `bankbook_payment_count` | `bankbook_payments` |
| `bankbook_balance_krw` | `bankbook_balance` |
| `residence_region` | `region` |
| `residence_period_years` | `residence_period_years` |
| `is_homeless` | `is_homeless`, `housing_ownership` 반대값 |
| `homeless_period_years` | `homeless_period_years` |
| `is_household_head` | `is_household_head` |
| `household_member_count` | `num_household_members` |
| `marital_status` | `marital_status` |
| `marriage_period_years` | `marriage_period_years` |
| `birth_year` | `birth_year` |
| `minor_child_count` | `minor_child_count`, `child_status`, `child_count_group` |
| `youngest_child_age_group` | `youngest_child_age_group` |
| `elderly_support_status` | `is_elderly_parent`, `elderly_parent_years` |
| `is_dual_income` | `is_dual_income` |
| `monthly_household_income_krw` | `average_monthly_income` |
| `has_household_property_ownership_history` | `has_property_history` |
| `total_assets_krw` | `total_assets` |

### 6.2 FastAPI 결과 → Django/React 표시

| FastAPI 필드 | Django serializer 출력 | React 표시 기준 |
|---|---|---|
| `recommended_supply` | `recommended_supply` | 추천 공급 유형 |
| `supply_rank[].type` | `supply_rank[].type` | 공급 유형명 |
| `supply_rank[].status` 또는 `score` | `supply_rank[].chance` | 가능성/검토 상태 |
| `supply_rank[].reason` | `supply_rank[].desc` | 추천 사유 |
| `supply_rank[].missing_items` | `missing_fields` | 추가 확인 항목 |
| `warnings` | `warnings` | 경고/부분 결과 안내 |
| `report.summary` | `report.summary` | 결과 요약 |
| `report.finance` 또는 `node5.*` | `report.finance` | 대출/실투자금/자금 리스크 |
| `report.strategy` 또는 `node5.agent_result` | `report.strategy` | 상세 전략 설명 |

중요: FastAPI 내부에서는 `missing_items`가 기본이고, Django 공개 응답에서는 `missing_fields`로 노출한다. React는 통합 과도기 동안 두 이름을 모두 읽되, 최종 공개 계약은 `missing_fields`로 고정한다.

## 7. 오늘 통합 리스크

| 리스크 | 현재 판단 | 대응 |
|---|---|---|
| 은진 프론트 브랜치 미통합 | 최신 `version-1` 이전 지점에서 갈라짐 | 동윤 Django 개선 후 재병합 |
| `ResultDetail.tsx` 충돌 | jihun 응답 필드 대응과 은진 UI 개선이 같은 영역 수정 | 양쪽 로직을 모두 살려 수동 병합 |
| 현재 `version-1` 프론트 mock 기본값 | `VITE_USE_MOCK_API !== "false"`라 기본 mock 가능 | 은진 브랜치의 mock 제거 방향 반영 |
| ChromaDB 로컬 차이 | Git에 포함하지 않는 산출물 | `build_all.py` 실행 후 6개 collection 확인 |
| FastAPI error 응답 과도기 | 일부는 `status=error`, 일부는 HTTPException | React/Django에서 사용자 메시지 기준 정리 필요 |

## 8. 오늘 로드맵

### 1단계: 기준 고정

- 최신 `origin/version-1`을 기준으로 작업한다.
- jihun 병합 커밋 `4019b00` 이후 상태를 기준으로 API 계약을 확정한다.
- 은진 프론트 브랜치는 통합 전 참고 대상으로 둔다.

### 2단계: 응답 계약 공유

- 지훈에게 FastAPI 응답 필드가 이 문서와 맞는지 확인 요청.
- 동윤에게 Django 저장/serializer 기준을 이 문서로 맞춰달라고 공유.
- 은진에게 결과 화면은 `recommended_supply`, `supply_rank`, `warnings`, `report`, `report.finance`, `report.strategy` 중심으로 매핑해달라고 공유.

### 3단계: 검증

최소 검증:

```cmd
python django_backend\manage.py check
python django_backend\manage.py test accounts strategy
python -c "import sys; sys.path.insert(0, 'Backend'); from main import app; print('fastapi import ok')"
cd frontend-react
pnpm.cmd run build
```

ChromaDB 확인:

```cmd
python -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

기대 collection:

```text
faq_chunks, guide_chunks, law_chunks, lh_guide_chunks, manual_chunks, web_faq_chunks
```

현재 문서 작성 시점 검증 결과:

```text
Django manage.py check: OK
Django accounts + strategy tests: 25 passed
FastAPI app import: OK
React production build: OK
ChromaDB collection count: [] in this worktree
```

주의:

- jihun 병합 이후 FastAPI는 `langgraph-checkpoint-sqlite`가 필요하다.
- `requirements.txt`에는 이미 `langgraph-checkpoint-sqlite==3.1.0`이 포함되어 있으므로, 기존 `.venv`를 쓰던 팀원은 `pip install -r requirements.txt`를 다시 실행해야 한다.
- 현재 worktree의 ChromaDB collection은 비어 있으므로 RAG/챗봇까지 확인하려면 `build_all.py` 재실행이 필요하다.

### 4단계: 통합 순서

1. 동윤 Django 개선사항을 최신 `version-1`에 반영.
2. API 계약과 Django serializer 결과가 맞는지 확인.
3. 은진 프론트 브랜치를 최신 `version-1` 기준으로 병합.
4. `ResultDetail.tsx` 충돌을 수동 해결.
5. mock 제거/실제 API 연결 상태 확인.
6. PDF → 전략 진단 → 결과 상세 → 마이페이지 이력 → 챗봇 순서로 브라우저 QA.

## 9. 팀 공유 메시지 초안

```text
오늘은 최신 version-1(jihun 백엔드 병합 이후)을 기준으로 API 응답 계약과 서비스 흐름을 고정하겠습니다.

핵심 기준은 React -> Django 공개 API -> FastAPI 내부 API 흐름이고,
Django는 인증/저장/proxy, FastAPI는 LLM/RAG/PDF/진단 응답 생성을 맡는 구조로 정리했습니다.

은진님 프론트 브랜치는 최신 version-1 이전 기준에서 갈라져 있어 바로 병합하지 않고,
동윤님 Django 개선사항이 들어온 뒤 ResultDetail.tsx 충돌과 응답 필드 매핑을 기준으로 통합하는 순서가 안전해 보입니다.

프론트 결과 화면 기준 필드는 recommended_supply, supply_rank, warnings, report.summary, report.finance, report.strategy로 잡겠습니다.
```
