# version-1 API 계약 정리 추적

작업일: 2026-07-06  
작업 브랜치: `version-1-api-contract`  
기준 브랜치: `origin/version-1`  
기준 커밋: `5a12726`

## 1. 작업 목적

0703 회의에서 준억 담당으로 정해진 항목은 다음이다.

```text
전체 구조 변경 방향과 FastAPI 응답 형태 결정
서비스별 책임과 요청·응답 구조가 문서화되어 팀원이 같은 규격을 사용함
```

주말 이후 jihun 백엔드 개선사항이 `version-1`에 병합되었고, eunjin 프론트 개선 브랜치는 아직 통합 전이다. 따라서 오늘 작업의 목적은 코드를 바로 합치는 것이 아니라, 최신 백엔드 기준 API 응답 계약과 통합 순서를 확정하는 것이다.

## 2. 확인한 브랜치 상태

확인 명령:

```cmd
git fetch origin version-1:refs/remotes/origin/version-1
git log --oneline --decorate -5 origin/version-1
```

확인 결과:

```text
5a12726 docs: move merge record into changelog
f99e86c docs: record jihun merge into version-1
4019b00 Merge branch 'jihun' into version-1
bf0c5ff backend 수정
e93260a version-1 브랜치 정상화 반영 / 아직 수정 중..
```

판단:

- jihun 백엔드 개선사항은 최신 `version-1`에 반영되어 있다.
- 은진 프론트 브랜치 `origin/eunjin/frontend`는 `e93260a` 기준에서 갈라져 최신 jihun 병합을 포함하지 않는다.
- `origin/version-1`과 `origin/eunjin/frontend`를 비파괴 merge-tree로 확인했을 때 `frontend-react/src/app/pages/ResultDetail.tsx` 충돌 가능성이 확인되었다.

## 3. 확인한 주요 파일

FastAPI:

- `Backend/app/routers/profile.py`
- `Backend/app/routers/simulate_router.py`
- `Backend/app/routers/announcement_router.py`
- `Backend/app/routers/pdf_router.py`
- `Backend/app/routers/chat_router.py`
- `Backend/app/services/profile_service.py`
- `Backend/app/services/simulate_service.py`
- `Backend/app/services/announcement_service.py`
- `Backend/app/services/pdf_service.py`
- `Backend/app/services/chat_service.py`
- `Backend/src/pipeline.py`
- `Backend/src/engine/node1.py`
- `Backend/src/engine/node2.py`
- `Backend/src/engine/node3.py`
- `Backend/src/engine/node4.py`
- `Backend/src/engine/node5.py`
- `Backend/src/engine/node6.py`

Django:

- `django_backend/strategy/views.py`
- `django_backend/strategy/services.py`
- `django_backend/strategy/serializers.py`
- `django_backend/strategy/adapters.py`
- `django_backend/strategy/models.py`

React:

- `frontend-react/src/app/api/client.ts`
- `frontend-react/src/app/pages/ResultDetail.tsx`
- `frontend-react/src/app/pages/PdfAnalysis.tsx`
- `frontend-react/src/app/pages/StrategyRun.tsx`

## 4. 핵심 판단

### 4.1 FastAPI 내부 계약

FastAPI의 내부 호출 흐름은 다음으로 확정한다.

```text
프로필 전송: POST /api/profile
상세 여부 선택: POST /api/simulate
공고문 입력: POST /api/announcement
PDF 추출: POST /api/pdf/analyze
챗봇 질문: POST /api/chat
```

기본 진단:

```text
/api/profile -> /api/simulate(simulate=false)
```

상세 진단:

```text
/api/profile -> /api/simulate(simulate=true) -> /api/announcement
```

### 4.2 Django 공개 계약

React는 FastAPI를 직접 호출하지 않고 Django 공개 API만 호출한다.

```text
POST /api/strategy
GET /api/strategy/me
GET /api/strategy/{strategy_id}
POST /api/pdf/analyze
POST /api/chatbot
```

Django는 StrategyRun에 다음을 저장한다.

- `input_snapshot`: 당시 프로필과 공고/PDF 입력 정보
- `result_payload`: FastAPI 원본 응답

Django serializer는 React 표시용으로 다음 필드를 추가로 만든다.

- `diagnosis_mode`
- `overall_analysis_status`
- `announcement_confirmed`
- `recommended_supply`
- `recommended_supply_types`
- `supply_rank`
- `missing_fields_by_supply_type`
- `warnings`
- `report`

### 4.3 프론트 통합 주의점

현재 최신 `version-1`의 `frontend-react/src/app/api/client.ts`는 mock fixture import와 `VITE_USE_MOCK_API` 기본값을 여전히 가진다. 공지에 따르면 은진님 브랜치에서 mock 제거와 실제 API 연결 개선이 진행되었다.

따라서 프론트 통합 시 확인할 항목은 다음이다.

- mock 기본값 제거 또는 기본 실제 API 사용
- 로그인 유지/보호 라우팅과 Django session cookie 정합성
- ResultDetail에서 `missing_items`와 `missing_fields` 양쪽 대응
- `report.finance`, `report.strategy`, `warnings`, `supply_rank` 표시 유지
- `ResultDetail.tsx` 충돌 수동 해결

## 5. 산출물

추가 문서:

- `docs/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md`

수정 문서:

- `docs/README.md`

## 6. 남은 확인

문서 기준 정리 후 다음 검증을 수행했다.

```text
git diff --check: OK
Django manage.py check: OK
Django accounts + strategy tests: 25 passed
FastAPI app import: OK
React production build: OK
ChromaDB collection count: []
```

검증 중 발견한 사항:

- 최초 FastAPI import는 `ModuleNotFoundError: No module named 'langgraph.checkpoint.sqlite'`로 실패했다.
- 원인은 최신 `requirements.txt`에는 `langgraph-checkpoint-sqlite==3.1.0`이 들어가 있지만, 검증에 사용한 기존 `.venv`에는 아직 설치되어 있지 않았기 때문이다.
- 검증용 `.venv`에 `langgraph-checkpoint-sqlite==3.1.0`을 설치한 뒤 FastAPI import가 통과했다.
- 팀원도 기존 가상환경을 재사용한다면 `pip install -r requirements.txt` 재실행이 필요하다.
- ChromaDB는 이 worktree에서 collection이 `[]`로 확인되어, RAG/챗봇 실동작 검증 전 `Backend/src/preprocessing/build_all.py` 재실행이 필요하다.

실제 API 호출 기반 검증은 서버 3개와 `.env`, ChromaDB, OpenAI key 상태가 준비된 뒤 진행한다.
