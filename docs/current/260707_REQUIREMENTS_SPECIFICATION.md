# 청약 진단 서비스 요구사항 정의서

| 항목 | 내용 |
|---|---|
| 문서 상태 | 초안 (Draft) |
| 작성일 | 2026-07-07 |
| 작성자 | 지훈 |
| 기준 브랜치 | `final` (2026-07-07, `integrate-eunjin-v2-0707` 반영 검토 중) |
| 대상 시스템 | React(frontend-react) / Django(django_backend) / FastAPI·LangGraph·RAG(Backend) |
| 근거 문서 | `docs/current/`, `docs/traces/`, `docs/frontend/`, `docs/guides/`, `docs/reports/`, `README.md` 전체 |

## 0. 문서 개요

### 0.1 목적

이 문서는 청약 진단 서비스의 기능·비기능 요구사항을 확정하고, LLM/외부 API 연동 방식과 예외 처리 기준을 명확히 하며, 사용자 시나리오를 기준으로 요구사항의 타당성을 검증하고, 요구사항이 화면설계·개발·테스트 산출물과 일관되게 연결되도록 추적성을 확보하는 것을 목적으로 한다.

### 0.2 범위

React SPA, Django REST API, FastAPI(LangGraph 파이프라인·RAG 챗봇·PDF 추출)로 구성된 청약 프로필 기반 전략 진단 서비스 전체를 범위로 한다. 배포(Docker/CI/AWS)는 현재 미완료 상태이며, 이 문서에서는 요구사항으로 명시하되 별도 완료 기준을 둔다.

### 0.3 용어 정의

| 용어 | 정의 |
|---|---|
| 전략 진단 | 사용자 프로필과(선택적으로) 공고문 정보를 기반으로 추천 공급유형, 자격 판정, 재무 분석, 전략 설명을 산출하는 핵심 기능 |
| profile_only | 공고문 없이 프로필만으로 기본 진단을 수행하는 모드 |
| diagnosis_text | PDF에서 추출한 공고문을 전략 진단 입력용으로 정리한 구조화 텍스트 |
| summary_text | 사용자 확인/이력 식별용으로 만든 PDF 공고문 짧은 요약 |
| extracted_fields | PDF에서 규칙 기반으로 우선 추출한 공고명·위치·주택형·공급금액 등 구조화 필드 |
| StrategyRun | Django에 저장되는 진단 실행 단위(입력 스냅샷 + 결과 payload + 상태) |
| Node 1~6 | FastAPI LangGraph 파이프라인의 프로필 정규화 → 점수 계산 → 분기 → 공고문 구조화 → 전략 수립 → 리포트 생성 단계 |
| RAG | ChromaDB 기반 검색-증강 생성. 챗봇과 일부 전략 판단(지역 우선공급, 청약 시점)에 사용 |
| 공개 API | React가 직접 호출하는 Django API. FastAPI는 브라우저가 직접 호출하지 않는 내부 API |

### 0.4 참고 문서

| 목적 | 문서 |
|---|---|
| 현재 구조·정상화 요약 | `docs/current/VERSION1_CURRENT_ARCHITECTURE.md` |
| API 응답 계약 | `docs/current/260706_VERSION1_API_RESPONSE_CONTRACT.md` |
| 통합 현황·팀 전달 메모 | `docs/current/260706_VERSION1_INTEGRATION_HANDOFF.md` |
| PDF 분석 개선 현황 | `docs/current/260707_VERSION1_PDF_ANALYSIS_STATUS.md` |
| 프론트 화면설계 | `docs/frontend/SCREEN_DESIGN.md` |
| 프론트 요구사항 추적표 | `docs/frontend/REQUIREMENTS_TRACEABILITY.md` |
| 프론트 테스트 결과 | `docs/frontend/260706_TEST_REPORT.md` |
| MVP 명세/원칙 | `docs/traces/260703_PROJECT_SPEC.md` |
| API 계약 상세 | `docs/traces/260703_API_CONTRACT.md` |
| 팀 작업 가이드 | `docs/guides/TEAM_GUIDE.md` |
| 수정 기록(근본 원인) | `docs/traces/fix-log.md` |
| PDF 개선 추적 | `docs/traces/260707_PDF_IMPROVEMENT_TRACKING.md` |

---

## 1. 시스템 개요

### 1.1 전체 구조

```text
Browser
  -> React/Vite (:5173)
      -> Django REST API (:8000)      -- 인증·세션·저장·공개 API 경계
          -> FastAPI AI API (:8080)   -- LangGraph·RAG·PDF 추출
              -> LangGraph Pipeline (Node 1~6)
              -> OpenAI API (LLM)
              -> ChromaDB (RAG 벡터 검색)
```

React는 Django 공개 API만 호출하고, Django가 FastAPI 내부 API를 순차 호출한 뒤 결과를 저장·응답한다. 브라우저는 FastAPI를 직접 호출하지 않는다.

### 1.2 서비스 책임

| 서비스 | 책임 | 하지 않는 일 |
|---|---|---|
| React | 사용자 입력, 화면 전환, 결과 표시, 챗봇 UI, 로딩/오류 상태 | FastAPI 내부 필드 직접 조립, FastAPI 직접 호출 |
| Django | 인증, 세션, 권한, 사용자 데이터 저장, FastAPI proxy, 진단 이력 저장 | LLM/RAG 판단 로직 재구현 |
| FastAPI | LangGraph 파이프라인, PDF 텍스트/표 추출, RAG/챗봇, 최종 진단 응답 생성 | 사용자 session cookie 관리 |
| ChromaDB | RAG 검색용 6개 collection 저장 | Git 포함 공유 DB 역할(로컬 산출물) |

원칙: React는 Django 공개 API만 호출한다. Django는 FastAPI 내부 API를 호출하고 결과를 저장·전달한다. FastAPI 응답 구조가 바뀌면 Django serializer와 React 결과 화면을 함께 조정한다. `null`, `0`, `false`, 필드 누락은 서로 다른 값으로 취급하며 adapter가 임의로 값을 바꾸지 않는다.

### 1.3 이해관계자

| 역할 | 책임 |
|---|---|
| PM·React 담당 | 사용자 흐름, 결과/로딩/오류/챗봇 UI |
| Tech Lead·통합 담당 | API 계약, PDF 범위, 통합 Gate, 배포 기준 |
| Django API 담당 | 세션 인증, 모델, adapter, 상태 저장, 환경설정 |
| FastAPI·RAG 담당 | LangGraph/RAG, timeout·fallback, 초기화 분리 |
| 서비스 이용자(최종 사용자) | 회원가입 후 프로필을 등록하고 전략 진단·챗봇을 이용하는 주 사용자 |

---

## 2. 사용자 시나리오 (User Scenario / Use Case)

사용자 관점에서 도출한 8개 핵심 시나리오다. 모든 시나리오는 실제 화면(URL)과 API 호출 순서로 검증 가능하다.

### UC-01 회원가입 및 로그인

| 항목 | 내용 |
|---|---|
| 액터 | 비로그인 사용자 |
| 목표 | 이메일/비밀번호로 계정을 만들고 서비스를 이용할 수 있는 상태가 된다 |
| 사전조건 | 없음 |
| 기본 흐름 | ① `/login`에서 이메일·비밀번호·비밀번호 확인 입력 → ② `POST /api/auth/signup` → ③ 가입과 동시에 세션 발급(자동 로그인) → ④ 원래 접근하려던 보호 화면 또는 `/profile`로 이동 |
| 대안 흐름 | 이미 계정이 있으면 `POST /api/auth/login`으로 로그인. `email` 대신 `username` 사용 가능 |
| 예외 흐름 | 이메일 중복 → 필드 오류 메시지 표시. 비밀번호 규칙 미충족 → 즉시 검증 메시지. 로그인 실패(자격 불일치) → 상단 오류 안내. 로그인 10회/분 초과 → throttle 오류 |
| 사후조건 | Django session cookie 발급, `GET /api/auth/me`로 로그인 상태 확인 가능 |
| 연결 화면/API | `/login` · `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` |

### UC-02 청약 프로필 등록·수정

| 항목 | 내용 |
|---|---|
| 액터 | 로그인 사용자 |
| 목표 | 전략 진단에 사용할 청약 조건(청약통장, 거주, 무주택, 세대, 혼인·자녀, 소득·자산)을 저장한다 |
| 사전조건 | 로그인 상태 |
| 기본 흐름 | ① `/profile` 진입 → ② `GET /api/user/profile` 조회(없으면 404 → 신규 작성 화면) → ③ 필수/조건부 항목 입력 → ④ `PUT /api/user/profile` 저장 |
| 대안 흐름 | 혼인 상태가 기혼이면 혼인기간·맞벌이 여부 노출, 무주택이면 무주택기간 노출 등 조건부 입력 노출/해제 시 값 초기화 |
| 예외 흐름 | 필수 필드 누락, 형식 오류 시 필드 단위 오류 표시 |
| 사후조건 | 사용자 소유 Profile 레코드 upsert |
| 연결 화면/API | `/profile` · `GET/PUT/PATCH /api/user/profile` |

### UC-03 기본 프로필 기반 전략 진단

| 항목 | 내용 |
|---|---|
| 액터 | 프로필을 저장한 로그인 사용자 |
| 목표 | 공고문 없이 내 조건만으로 어떤 공급유형에 지원 가능성이 있는지 확인한다 |
| 사전조건 | 필수 프로필 항목 저장 완료 |
| 기본 흐름 | ① `/strategy`에서 "공고 없이 진단" 선택 → ② `POST /api/strategy` `{profile_only:true}` → ③ Django가 FastAPI `/api/profile` → `/api/simulate(simulate:false)` 순차 호출 → ④ `StrategyRun` 저장 → ⑤ `/results/:id`로 이동 |
| 예외 흐름 | 프로필 자체가 없으면 400 `PROFILE_REQUIRED`, 필수 필드만 비어 있으면 400 `PROFILE_REQUIRED_FIELDS_MISSING`. FastAPI 연결 실패 시 502 `FASTAPI_CONNECTION_FAILED`, 응답 지연(timeout) 시 504 `FASTAPI_TIMEOUT` |
| 사후조건 | 결과 화면에서 추천 공급유형·순위·요약 확인 가능 |
| 연결 화면/API | `/strategy` → `/results/:id` · `POST /api/strategy` |

### UC-04 수동 공고문 텍스트 기반 상세 진단

| 항목 | 내용 |
|---|---|
| 액터 | 로그인 사용자 |
| 목표 | 관심 있는 모집공고 내용을 직접 입력해 상세 전략(자격, 재무, 경쟁력)을 확인한다 |
| 기본 흐름 | ① `/strategy`에서 공고문 텍스트 입력 → ② `POST /api/strategy` (`announcement_text` 포함, `profile_only:false`) → ③ FastAPI `/api/profile` → `/api/simulate(simulate:true)` → `/api/announcement` 순차 호출 → ④ 결과 저장·표시 |
| 예외 흐름 | 공고문 미입력 시 실행 버튼 비활성화. 90초 백엔드 타임아웃/95초 프론트 abort 초과 시 타임아웃 안내. LLM 구조화 실패 시 fallback 텍스트로 계속 진행 |
| 연결 화면/API | `/strategy` · `POST /api/strategy` → FastAPI `/api/profile`, `/api/simulate`, `/api/announcement` |

### UC-05 PDF 모집공고 업로드 기반 진단

| 항목 | 내용 |
|---|---|
| 액터 | 로그인 사용자 |
| 목표 | 청약홈/마이홈 모집공고 PDF를 업로드해 핵심 항목을 자동 추출하고, 확인/수정 후 전략 진단에 사용한다 |
| 기본 흐름 | ① 전략 진단 화면(또는 `/pdf`)에서 PDF 파일 선택/드래그 → ② `POST /api/pdf/analyze` (15MB 이하) → ③ FastAPI가 텍스트/표 추출 후 규칙 기반 정리 + (가능 시) LLM 요약으로 `summary_text`/`diagnosis_text`/`extracted_fields` 생성 → ④ 사용자가 `diagnosis_text` 확인/수정 → ⑤ `POST /api/strategy`에 `announcement_text`, `input_method:"pdf"`, `pdf_analysis_id`, `pdf_summary_text`, `pdf_extracted_fields` 전달 |
| 예외 흐름 | PDF가 아닌 파일 → 400 `PDF_INVALID_TYPE`. 15MB 초과 → 400 `PDF_TOO_LARGE`. 텍스트 추출량 부족 시 PyMuPDF fallback. LLM 요약 실패 시 규칙 기반 정리본으로 계속 진행(진단 중단 없음) |
| 사후조건 | PDF 원본은 저장하지 않음. `summary_text`/`extracted_fields`는 진단 이력 식별용으로 `StrategyRun.input_snapshot`에 저장 |
| 연결 화면/API | `/pdf`, `/strategy` · `POST /api/pdf/analyze` → FastAPI `/api/pdf/analyze` |

### UC-06 진단 이력 조회 (마이페이지 / 결과 상세)

| 항목 | 내용 |
|---|---|
| 액터 | 로그인 사용자 |
| 목표 | 과거에 실행한 진단 목록과 상세 결과를 다시 확인한다 |
| 기본 흐름 | ① `/mypage` 진입 → ② `GET /api/strategy/me`로 목록 조회(공고 기반 진단은 아파트명/공고명, 공고 없는 진단은 "청약 가능성 분석"으로 표시) → ③ 항목 선택 → ④ `GET /api/strategy/{id}`로 상세 조회 |
| 예외 흐름 | 목록/상세 조회 실패 시 오류 안내. 저장된 진단이 없으면 빈 상태 안내 |
| 연결 화면/API | `/mypage`, `/results/:id` · `GET /api/strategy/me`, `GET /api/strategy/{id}` |

### UC-07 RAG 챗봇 질의응답

| 항목 | 내용 |
|---|---|
| 액터 | 로그인 사용자 |
| 목표 | 청약 제도(무주택 기간, 가점, 소득 기준 등)에 대해 질문하고 근거 출처와 함께 답을 확인한다 |
| 기본 흐름 | ① 데스크톱 우측 패널 또는 `/chatbot`에서 질문 입력(추천 질문 선택 가능) → ② `POST /api/chatbot` → ③ Django가 FastAPI `/api/chat` 호출(첫 호출 시 RAG 그래프 지연 초기화) → ④ ChromaDB 검색 → 답변 생성 → ⑤ 답변과 출처 토글 표시. 후속 질문은 같은 `session_id`로 이어감 |
| 예외 흐름 | 챗봇 초기화 실패(ChromaDB 미구축/`OPENAI_API_KEY` 누락) 시 503 응답과 안내 메시지. 검색 실패 시 `found=False`로 처리하되 답변 자체는 계속 시도. 답변 생성 LLM 실패 시 안내 메시지로 대체 |
| 사후조건 | 메시지·`session_id`는 브라우저 탭 세션 동안 유지 |
| 연결 화면/API | 우측 패널, `/chatbot` · `POST /api/chatbot` → FastAPI `/api/chat` |

### UC-08 보호 라우팅 및 세션 유지

| 항목 | 내용 |
|---|---|
| 액터 | 모든 사용자 |
| 목표 | 로그인하지 않은 사용자는 보호된 화면(프로필, 전략진단, 마이페이지, 챗봇 등)에 접근할 수 없어야 하며, 로그인 사용자는 페이지 이동 중 로그인 상태가 유지되어야 한다 |
| 기본 흐름 | ① 보호 URL 접근 → ② `AuthProvider`가 `GET /api/auth/me` 확인 → ③ 인증 성공 시 화면 표시, 실패 시 `/login`으로 이동 → ④ 로그인 후 원래 URL 또는 `/profile`로 복귀 |
| 예외 흐름 | 인증 조회 자체가 실패(네트워크 오류 등)하면 비로그인 상태로 간주해 안전하게 처리 |
| 연결 화면/API | 전체 보호 라우트 · `GET /api/auth/me` |

---

## 3. 기능 요구사항 (Functional Requirements)

ID 체계는 도메인 접두어(AUTH/PROFILE/STRATEGY/PDF/CHAT/HIST)를 사용한다. 프론트 요구사항 추적표(`docs/frontend/REQUIREMENTS_TRACEABILITY.md`)의 기존 FR-01~13/NFR-01~09과의 대응 관계는 표마다 반복 표기하지 않고 [부록 A. ID 매핑표](#부록-a-id-매핑표)에 한 번만 정리한다. 각 표의 "요구사항"은 사용자·비즈니스 관점의 What만 기술하고, 실제 구현 방식(클래스명, 상태 플래그 등)은 "구현 참고" 열에 분리해 요구사항과 설계를 구분한다. 우선순위는 MoSCoW(Must/Should/Could) 기준이다.

### 3.1 인증·권한 (FR-AUTH)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-AUTH-01 | Must | 사용자는 이메일과 비밀번호로 로그인할 수 있어야 한다 | `email` 또는 `username`, `password` | 성공: session cookie + 사용자 정보. 실패: 401 인증 오류 | 완료 | Django session 인증(`LoginAPIView`) |
| FR-AUTH-02 | Must | 사용자는 계정을 생성하고 비밀번호 규칙을 확인할 수 있어야 한다 | `email`(필수), `password`(필수), `username`(선택, 생략 시 email 사용) | 성공: 가입+세션 발급. 실패: 필드 오류(이메일 중복 등) | 완료 | 이메일 정규화, 중복 검사, 비밀번호 검증 후 자동 로그인 |
| FR-AUTH-03 | Must | 로그인한 사용자는 페이지를 이동해도 다시 로그인하지 않아야 한다 | 없음(session cookie) | 로그인 사용자 정보 또는 401 | 완료 | `AuthProvider`가 앱 진입 시 `GET /api/auth/me` 조회 |
| FR-AUTH-04 | Must | 로그인하지 않은 사용자는 보호된 화면에 접근할 수 없어야 한다 | 없음 | 접근 차단 및 원래 경로 보존 | 완료 | 보호 라우트 진입 시 인증 확인 후 미인증이면 `/login`으로 redirect |
| FR-AUTH-05 | Must | 로그인 시도는 짧은 시간 내 과도하게 반복될 수 없어야 한다(분당 10회 제한) | 로그인 요청 | 초과 시 429 오류 | 완료 | `LoginRateThrottle`(`SimpleRateThrottle` 상속) |
| FR-AUTH-06 | Must | 회원가입은 이메일 중복, 약한 비밀번호, 반복적인 가입 시도로부터 보호되어야 한다 | 회원가입 요청 | 위반 시 400 필드 오류 | 완료 | 이메일 정규화, 비밀번호 검증, `SignUpRateThrottle` |
| FR-AUTH-07 | Could | 사용자는 자신의 계정과 연관 데이터를 삭제할 수 있어야 한다 | 인증된 사용자 | 사용자 및 연관 데이터 물리 삭제 | 완료(계약 정의됨, 화면 연동 확인 필요) | `DELETE /api/auth` |

### 3.2 프로필 관리 (FR-PROFILE)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-PROFILE-01 | Must | 사용자는 청약 프로필을 조회·저장할 수 있어야 한다 | 청약통장/거주/무주택/세대/혼인/자녀/소득·자산 필드 | 저장 완료 또는 필드별 검증 오류. 미저장 시 404 → 신규 작성 화면 | 완료 | `GET/PUT/PATCH /api/user/profile` |
| FR-PROFILE-02 | Should | 사용자는 자신과 관련 없는 조건부 입력 항목을 보지 않아야 하며, 조건을 해제하면 그에 딸린 하위 입력값도 함께 제거되어야 한다 | 조건 필드(혼인상태, 무주택여부, 세대원수, 자녀수 등) | 해제 시 하위 값 초기화 | 완료 | 조건부 UI 노출/해제 로직 |
| FR-PROFILE-03 | Should | 혼인 상태가 기혼인 사용자는 맞벌이 여부를 반드시 입력해야 한다 | 혼인상태, 맞벌이 여부 | 누락 시 필드 오류 | 완료(enum 강제는 미완료, 값 변경 시 별도 테스트 필요) | 서버 측 조건부 필수 검증(`marital_status=MARRIED` → `is_dual_income` 필수) |

### 3.3 전략 진단 (FR-STRATEGY)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-STRATEGY-01 | Must | 사용자는 공고문 없이 프로필만으로 기본 진단을 실행할 수 있어야 한다 | `profile_only:true` | `recommended_supply`, `supply_rank`, `report.summary` | 완료 | Django→FastAPI `/api/profile`→`/api/simulate(false)` |
| FR-STRATEGY-02 | Must | 사용자는 공고문 텍스트를 입력해 상세 진단을 실행할 수 있어야 한다 | `announcement_text`, `profile_only:false` | `report.finance`, `report.strategy`, `warnings` 포함 상세 결과 | 완료 | `/api/profile`→`/api/simulate(true)`→`/api/announcement` |
| FR-STRATEGY-03 | Must | 필수 프로필 정보가 없는 사용자는 진단을 실행할 수 없어야 한다 | 프로필 상태 | Profile 레코드 자체가 없으면 400 `PROFILE_REQUIRED`, 레코드는 있으나 필수 필드가 비어 있으면 400 `PROFILE_REQUIRED_FIELDS_MISSING`(공통 예외 핸들러 기본 코드) | 완료 | Django `ProfileSerializer` 사전 검증 |
| FR-STRATEGY-04 | Should | 사용자는 동일한 진단을 동시에 여러 번 실행할 수 없어야 한다 | 실행 버튼 상태 | 중복 요청 차단 | 완료 | `isRunning` 플래그, 버튼/입력 비활성화 |
| FR-STRATEGY-05 | Must | 진단 요청은 응답이 지나치게 지연되면 무한 대기하지 않고 사용자에게 결과(성공/실패)를 알려야 한다 | 없음 | 초과 시 사용자용 타임아웃/오류 메시지 | 완료 | 백엔드 timeout(엔드포인트별 상이) + 프론트 95초 `AbortController` |
| FR-STRATEGY-06 | Should | 사용자는 진단 결과의 상태(진행중/성공/실패)를 항상 확인할 수 있어야 한다 | 없음 | 상태값 `PENDING\|RUNNING\|SUCCEEDED\|FAILED` | 완료(응답 형태 단일화는 진행 중) | `StrategyRunSerializer`가 `id`, `status`, `input_snapshot`, `result_payload` 등 표준 필드로 응답 |

### 3.4 PDF 분석 (FR-PDF)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-PDF-01 | Must | 사용자는 PDF 모집공고를 분석해 전략 입력으로 전달할 수 있어야 한다 | PDF 파일(15MB 이하) | `diagnosis_text`, `summary_text`, `extracted_fields` | 완료 | `pdfplumber`/PyMuPDF 추출 → 규칙 기반 정리 → (선택) LLM 요약 |
| FR-PDF-02 | Must | 사용자가 업로드한 PDF 원본은 서버에 저장되지 않아야 한다 | PDF 파일 | 원본 미저장, 파일명만 snapshot 보존 | 완료 | 메모리 내 처리만 수행 |
| FR-PDF-03 | Must | PDF가 아니거나 크기 제한(15MB)을 초과한 파일은 명확한 사유와 함께 거부되어야 한다 | 파일 | 400 `PDF_INVALID_TYPE`, 400 `PDF_TOO_LARGE` | 완료 | MIME/확장자/크기 검사 |
| FR-PDF-04 | Should | 공급금액·주택형처럼 표에 있는 핵심 정보는 사용자가 다시 찾아보지 않아도 자동으로 인식되어야 한다 | PDF 표 데이터 | `extracted_fields.housing_types`, `price_summary` 등 | 완료(다른 PDF 샘플 추가 검증 필요) | 규칙 기반 추출 우선, LLM은 문장 다듬기 보조 |

### 3.5 챗봇/LLM 연동 (FR-CHAT)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-CHAT-01 | Must | 사용자는 청약 챗봇에 질문하고 근거 출처를 확인할 수 있어야 한다 | `question`, `session_id`(선택) | `answer`, `sources[]`, `session_id` | 완료 | FastAPI `/api/chat` → ChromaDB 검색 → LLM 답변 합성 |
| FR-CHAT-02 | Should | 사용자가 같은 브라우저 탭에서 후속 질문을 하면 이전 대화 맥락이 유지되어야 한다 | `session_id` | 새로고침 전까지 맥락 유지 | 완료 | `sessionStorage`에 메시지·`session_id` 저장 |
| FR-CHAT-03 | Should | 빈 질문은 전송할 수 없어야 한다 | `question` | 위반 시 400 검증 오류 | 완료 | 서버 측 trim 검증 |

### 3.6 진단 이력 (FR-HIST)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-HIST-01 | Must | 사용자는 자신이 저장한 진단 기록과 상세 결과를 다시 볼 수 있어야 한다 | 없음 | 목록/상세 데이터, 본인 소유만 조회 가능 | 완료 | `GET /api/strategy/me`, `GET /api/strategy/{id}` |
| FR-HIST-02 | Should | 사용자는 진단 기록 목록에서 공고 기반 진단과 공고 없는 진단을 제목만으로 구분할 수 있어야 한다 | `pdf_extracted_fields.announcement_name` 등 | 식별 가능한 제목 표시(공고 기반: 공고명, 공고 없음: "청약 가능성 분석") | 완료 | 마이페이지/상세 표시 로직 |

### 3.7 오류 처리 (FR-ERR)

| ID | 우선순위 | 요구사항 | 입력 | 출력/예외 | 상태 | 구현 참고 |
|---|---|---|---|---|---|---|
| FR-ERR-01 | Must | 사용자는 오류가 발생했을 때 원인을 이해할 수 있는 메시지를 볼 수 있어야 한다 | 서버 오류 응답 | 사용자용 메시지 + 상세 필드 안내 | 완료 | `errorPresentation.ts`가 코드/필드 오류를 문구로 변환 |

### 3.8 핵심 요구사항 인수 기준 (Acceptance Criteria)

전체 요구사항 중 시나리오 검증 가치가 큰 핵심 항목만 발췌해 테스트 가능한 인수 기준을 정의한다. 그 외 항목은 2장 사용자 시나리오의 사전조건/기본흐름/예외흐름/사후조건으로 대체한다.

| ID | 인수 기준 |
|---|---|
| FR-AUTH-01/02 | ① 이메일·비밀번호 미입력 시 제출 불가 ② 존재하지 않는 이메일/틀린 비밀번호로 로그인 시 오류 메시지 노출 ③ 가입 성공 시 별도 로그인 없이 세션이 발급되고 `/profile`(또는 원래 URL)로 이동 ④ 이메일 중복 시 필드 단위 오류 표시 |
| FR-AUTH-04 | ① 비로그인 상태로 `/profile`, `/strategy`, `/mypage`, `/chatbot` 접근 시 `/login`으로 redirect ② 로그인 후 원래 요청했던 URL로 복귀 ③ 인증 조회 실패(네트워크 오류)도 비로그인으로 안전하게 처리 |
| FR-STRATEGY-01/02 | ① 필수 프로필 누락 시 실행 버튼이 비활성화되거나 400 오류 표시 ② 실행 중 버튼 재클릭이 중복 요청을 만들지 않음 ③ 정상 완료 시 `/results/:id`로 이동해 추천 공급유형·순위·요약이 표시됨 ④ 90초(공고 있음)/타임아웃 초과 시 사용자용 안내 문구 노출 |
| FR-PDF-01/03 | ① PDF가 아닌 파일 업로드 시 업로드 거부 및 오류 문구 노출 ② 15MB 초과 파일 업로드 시 거부 및 오류 문구 노출 ③ 정상 PDF는 `diagnosis_text`를 사용자가 확인/수정할 수 있는 상태로 화면에 표시 ④ 원본 파일이 서버 어디에도 저장되지 않음(응답에 원본 바이너리·경로 없음) |
| FR-CHAT-01/02 | ① 질문 전송 후 답변과 출처 목록이 함께 표시됨 ② 같은 탭에서 새로고침 없이 후속 질문 시 이전 대화가 이어짐 ③ 새로고침 시 대화가 초기화됨(브라우저 탭 세션 한정) ④ 챗봇 초기화 실패 시 503과 함께 사용자용 안내 문구가 표시되고 다른 화면은 정상 동작 |

---

## 4. 비기능 요구사항 (Non-Functional Requirements)

아래 표의 우선순위는 MoSCoW(Must/Should/Could) 기준이다.

### 4.1 성능 및 비동기 처리 (NFR-PERF)

| ID | 우선순위 | 요구사항 | 기준값 | 근거 |
|---|---|---|---|---|
| NFR-PERF-01 | Must | 기본 프로필 계산 요청은 짧은 시간 내 응답되거나 실패로 확정되어야 한다 | `FASTAPI_PROFILE_TIMEOUT=10초` | `.env` 설정 |
| NFR-PERF-02 | Must | 공고문 기반 상세 진단 요청은 LLM 연산 시간을 고려한 상한 내에 응답되거나 실패로 확정되어야 한다 | `FASTAPI_SIMULATE_TIMEOUT=30초`, `FASTAPI_ANNOUNCEMENT_TIMEOUT=90초` | `.env` 설정 |
| NFR-PERF-03 | Must | 챗봇 응답은 30초 이내에 완료되거나 실패로 확정되어야 한다 | `FASTAPI_CHATBOT_TIMEOUT=30초` | `.env` 설정 |
| NFR-PERF-04 | Must | PDF 분석은 90초 이내에 완료되거나 실패로 확정되어야 한다 | `FASTAPI_PDF_TIMEOUT=90초` | `.env` 설정 |
| NFR-PERF-05 | Must | 사용자는 백엔드가 응답하지 않아도 화면이 무한정 멈추지 않아야 한다 | 95초 초과 시 요청 강제 종료 | 프론트 `AbortController`(`docs/frontend/REQUIREMENTS_TRACEABILITY.md` NFR-03) |
| NFR-PERF-06 | Should | 사용자는 진단·PDF 분석이 진행 중일 때 같은 요청을 중복 실행할 수 없어야 한다 | 요청 진행 중 재실행 차단 | `isRunning`, `isUploading` 플래그 |
| NFR-PERF-07 | Should | 상세 전략 수립 응답은 불필요한 반복 LLM 호출로 지연되지 않아야 한다 | 재무 계산 3종 고정 순서 호출 + 합성 프롬프트 1회 | `docs/traces/fix-log.md` Fix 4 |

### 4.2 반응형 UI (NFR-UI)

| ID | 우선순위 | 요구사항 | 기준 |
|---|---|---|---|
| NFR-UI-01 | Must | 서비스는 모바일·태블릿·데스크톱 화면 폭에서 모두 정상적으로 사용할 수 있어야 한다 | Tailwind 기본 breakpoint 기준(`sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`). `xl`(1280px) 이상에서 우측 챗봇 패널 고정 노출, 그 미만은 모바일형 상단 스크롤 탭 |
| NFR-UI-02 | Should | 모바일 사용자는 별도 전용 화면에서 챗봇을 이용할 수 있어야 한다 | `xl`(1280px) 미만에서 `/chatbot` 전용 라우트 제공, 데스크톱 우측 고정 패널과 분리 |
| NFR-UI-03 | Should | 모션에 민감한 사용자를 위해 시스템 모션 감소 설정이 존중되어야 한다 | `prefers-reduced-motion` 대응 |
| NFR-UI-04 | Must | 사용자는 화면별로 로딩·오류·빈 상태를 명확히 구분해 볼 수 있어야 한다 | `docs/frontend/SCREEN_DESIGN.md` 3장 화면별 상태 정의 |

### 4.3 인증·보안 (NFR-SEC)

| ID | 우선순위 | 요구사항 | 현재 상태 |
|---|---|---|---|
| NFR-SEC-01 | Must | 로그인한 사용자의 요청은 본인 인증 정보를 포함해 전송되어야 한다 | 완료 (`credentials: "include"`) |
| NFR-SEC-02 | Must | 인증된 사용자의 API 요청 빈도는 분당 60회로 제한되어야 한다 | 완료 |
| NFR-SEC-03 | Must | 로그인 요청 빈도는 분당 10회로 제한되어야 한다 | 완료 |
| NFR-SEC-04 | Must | 사용자 화면에는 API 비밀값이나 내부 응답 메타데이터가 노출되지 않아야 한다 | 완료 |
| NFR-SEC-05 | Must | 운영 환경에서는 표준 CSRF 토큰 발급/전송 구조가 적용되어야 한다 | **미완료** — 현재 `CsrfExemptSessionAuthentication`으로 로컬 통합만 지원. 배포 전 필수 전환 대상 |
| NFR-SEC-06 | Must | 사용자는 다른 사용자의 프로필·진단·공고 데이터에 접근할 수 없어야 한다 | 완료 — Profile/StrategyRun/AnnouncementInput 소유권 기준 격리 |
| NFR-SEC-07 | Must | 허용된 출처(origin)에서만 API를 호출할 수 있어야 한다 | 완료 — CORS 허용 origin 환경변수 관리 |

### 4.4 가용성 및 장애 복원력 (NFR-RELIAB)

| ID | 우선순위 | 요구사항 | 처리 방식 |
|---|---|---|---|
| NFR-RELIAB-01 | Must | 문서 검색(RAG) 실패가 전체 진단 실패로 이어지지 않아야 한다 | 검색 실패 시 `found=False` 반환, 전체 진단은 계속 진행 |
| NFR-RELIAB-02 | Must | 챗봇 기능 오류가 다른 기능(진단 등)의 가용성에 영향을 주지 않아야 한다 | `_get_rag_app()` 지연 초기화, 실패는 503으로 격리 |
| NFR-RELIAB-03 | Should | LLM 호출 실패가 진단 전체를 중단시키지 않아야 한다 | `safe_llm_call(max_retries=1)`, 실패 시 규칙 기반 fallback 텍스트/요약 |
| NFR-RELIAB-04 | Should | 서버 재시작 후에도 진행 중이던 대화·진단 세션이 보존되어야 한다 | LangGraph 체크포인터를 `MemorySaver` → `SqliteSaver`로 전환 |
| NFR-RELIAB-05 | Must | 예기치 못한 오류가 발생해도 사용자에게는 정돈된 오류 메시지가 표시되어야 한다 | `_build_error_response` 최상위 안전망 |

### 4.5 데이터 원칙 (NFR-DATA)

| ID | 우선순위 | 요구사항 |
|---|---|---|
| NFR-DATA-01 | Must | `null`, `0`, `false`, 필드 누락은 서로 다른 값으로 취급되어야 하며 임의로 변환되지 않아야 한다 |
| NFR-DATA-02 | Must | 사용자가 업로드한 PDF 원본은 어떤 저장소에도 저장되지 않아야 한다 |
| NFR-DATA-03 | Should | 서비스 간 필드명이 달라도(`missing_items`/`missing_fields` 등) 매핑 기준이 문서화되어 일관되게 유지되어야 한다 |

### 4.6 배포 환경 (NFR-DEPLOY)

| ID | 우선순위 | 요구사항 | 현재 상태 |
|---|---|---|---|
| NFR-DEPLOY-01 | Should | 새로운 환경에서도 자동으로 재현 가능한 실행 구조(Docker Compose)가 제공되어야 한다 | **미완료** |
| NFR-DEPLOY-02 | Should | Django 테스트, FastAPI import, React build/test는 CI에서 자동으로 검증되어야 한다 | **미완료** (현재는 수동 명령 실행) |
| NFR-DEPLOY-03 | Should | 운영 환경에서는 SQLite 대신 PostgreSQL/RDS가 사용되어야 한다 | **미완료(계획 단계)** |
| NFR-DEPLOY-04 | Should | 운영 배포용 웹서버(Nginx/Gunicorn 등) 구성이 정의되어야 한다 | **미완료** |
| NFR-DEPLOY-05 | Must | 필수 환경변수는 문서화되어 팀원 누구나 동일하게 설정할 수 있어야 한다 | 완료 — `OPENAI_API_KEY`, `DJANGO_SECRET_KEY`, `FASTAPI_API_URL`, timeout 값 등 `.env.example`로 관리 |
| NFR-DEPLOY-06 | Could | 검색용 벡터 DB는 각 환경에서 재구축 가능해야 한다 | 완료(수동 절차) — ChromaDB는 Git 미포함, `build_all.py`로 재구축 |

### 4.7 테스트 가능성 (NFR-TEST)

| ID | 우선순위 | 요구사항 | 현재 상태 |
|---|---|---|---|
| NFR-TEST-01 | Must | 프론트 프로덕션 빌드는 항상 성공해야 한다 | 완료 (`corepack pnpm run build`) |
| NFR-TEST-02 | Should | 핵심 프론트 계약은 자동 테스트로 검증되어야 한다 | 부분 완료 — Node 내장 테스트 7건(소스 계약 수준), 실제 DOM/네트워크 모킹 테스트는 미구현 |
| NFR-TEST-03 | Must | Django 인증/전략 도메인은 자동 테스트로 검증되어야 한다 | 완료 — `accounts`, `strategy` 테스트 27건 통과 |
| NFR-TEST-04 | Should | FastAPI는 앱 import 및 `/health` 확인이 자동화되어야 한다 | 완료(수동 명령 기준) |

---

## 5. LLM 연동 요구사항 상세

이 장은 "외부 API 입출력 형식, 비동기 호출 방식, 예외 상황"을 명시하기 위한 전용 섹션이다.

### 5.1 연동 대상 API 목록

| 구분 | Method/Endpoint | 호출 주체 | 인증 | LLM 관여 |
|---|---|---|---|---|
| 공개 | `POST /api/strategy` | React → Django | 필요 | 간접(Django가 FastAPI 체인 호출) |
| 공개 | `POST /api/pdf/analyze` | React → Django | 필요 | 있음(요약/정리, 실패 시 규칙 기반) |
| 공개 | `POST /api/chatbot` | React → Django | 필요 | 있음(RAG 답변 생성) |
| 내부 | `POST /api/profile` | Django → FastAPI | 내부 전용 | 없음(Node1~2 규칙 계산) |
| 내부 | `POST /api/simulate` | Django → FastAPI | 내부 전용 | 조건부(공고문 있을 때 상세 분기) |
| 내부 | `POST /api/announcement` | Django → FastAPI | 내부 전용 | 있음(Node4 구조화, Node5 전략 수립) |
| 내부 | `POST /api/pdf/analyze` | Django → FastAPI | 내부 전용 | 있음(선택적 요약) |
| 내부 | `POST /api/chat` | Django → FastAPI | 내부 전용 | 있음(RAG 답변 합성) |
| 외부 | OpenAI API (Chat/Structured Output/Embedding) | FastAPI → OpenAI | API Key | 핵심 LLM 연산 |

### 5.2 요청/응답 스키마

#### 5.2.1 전략 진단 — `POST /api/strategy`

요청(PDF/공고문 기반):

```json
{
  "announcement_text": "사용자가 확인한 diagnosis_text 또는 수동 입력 공고문",
  "profile_only": false,
  "input_method": "pdf",
  "source_filename": "notice.pdf",
  "pdf_analysis_id": "uuid",
  "pdf_summary_text": "사용자 확인용 짧은 요약",
  "pdf_extracted_fields": {
    "announcement_name": "공고명",
    "location": "공급 위치"
  }
}
```

기본 진단 요청:

```json
{ "announcement_text": null, "profile_only": true }
```

응답 주요 필드: `id`, `strategy_id`, `status`(`PENDING|RUNNING|SUCCEEDED|FAILED`), `diagnosis_mode`(`PROFILE_ONLY|ANNOUNCEMENT_BASED`), `overall_analysis_status`(`COMPLETE|PARTIAL|FAILED|PENDING|RUNNING`), `recommended_supply`, `supply_rank`, `missing_fields_by_supply_type`, `warnings`, `report`(`summary`, `strategy`, `finance`), `input_snapshot`, `result_payload`.

#### 5.2.2 PDF 분석 — `POST /api/pdf/analyze`

요청: `multipart/form-data`, `file`(PDF, 15MB 이하).

응답:

```json
{
  "pdf_analysis_id": "uuid",
  "extraction_status": "EXTRACTED",
  "page_count": 52,
  "table_count": 101,
  "truncated": true,
  "raw_preview": "PDF 원문 추출 일부",
  "summary_text": "사용자 이력/확인용 짧은 요약",
  "diagnosis_text": "전략 진단 입력용 구조화 정리본",
  "summary_source": "llm",
  "extracted_fields": {
    "announcement_name": "공고명",
    "location": "공급 위치",
    "housing_category": "민영주택",
    "regulated_area": "투기과열지구, 청약과열지역",
    "housing_types": [],
    "price_summary": { "min_krw": 1206000000, "max_krw": 1707000000 }
  },
  "tables": [{ "page": 1, "rows": [["구분", "일정"]] }],
  "warnings": []
}
```

`summary_source`는 `llm` 또는 `rule`이며, LLM 요약 성공 여부를 사용자·개발자가 구분할 수 있게 한다.

#### 5.2.3 챗봇 — `POST /api/chatbot` / 내부 `POST /api/chat`

요청:

```json
{ "question": "무주택 기간은 어떻게 계산하나요?", "session_id": null }
```

응답:

```json
{ "answer": "답변 텍스트", "sources": ["출처 label"], "session_id": "uuid" }
```

초기화 실패 시(내부 FastAPI 응답):

```json
{ "detail": "챗봇 기능을 초기화하지 못했습니다. ChromaDB가 빌드되어 있는지, OPENAI_API_KEY가 올바른지 확인해주세요." }
```

HTTP status 503.

### 5.3 비동기 호출 방식

| 항목 | 방식 |
|---|---|
| 순차 체인 호출 | 공고문이 있으면 `profile → simulate(true) → announcement`, 없으면 `profile → simulate(false)` 순으로 Django가 FastAPI를 순차 호출한다 |
| Human-in-the-loop 대기 | Node4는 `interrupt()`로 LangGraph 실행을 일시정지하고 사용자의 공고문 입력을 기다린 뒤 `Command(resume=...)`로 재개한다 |
| 세션 영속화 | 파이프라인/챗봇 체크포인트는 `SqliteSaver`로 저장되어 FastAPI 재시작 후에도 진행 상태가 유지된다(단일 프로세스 전제) |
| 지연 초기화 | 챗봇 RAG 그래프는 첫 호출 시에만 초기화되어, 초기화 실패가 진단 API 가용성에 영향을 주지 않는다 |
| 프론트 비동기 UX | 요청 중 버튼/입력 비활성화, 로딩 상태 표시, 95초 초과 시 자동 중단(`AbortController`) |
| 엔드포인트별 timeout | `profile 10s`, `simulate 30s`, `announcement 90s`, `chat 30s`, `pdf 90s` (환경변수로 관리) |
| Node5 호출 최적화 | 의존관계가 명확한 재무 계산 3종은 코드로 고정 순서 호출하고, 나머지 3개 도구만 ReAct Agent에 위임해 LLM 왕복 횟수를 줄인다 |

### 5.4 예외 상황 정의

| 상황 | 처리 방식 |
|---|---|
| FastAPI 연결 실패/5xx | Django가 502 `FASTAPI_CONNECTION_FAILED`로 변환해 응답 |
| FastAPI 응답 시간 초과(timeout) | Django가 별도로 504 `FASTAPI_TIMEOUT`으로 변환해 응답(연결 실패와 분리된 코드, `strategy/services.py`) |
| LLM 호출 실패(Node4/5/6, RAG 답변 생성) | `safe_llm_call`이 1회 재시도 후 실패하면 `LLMCallError` 발생 → 각 노드가 fallback(빈 공고 정보+경고, 재무 계산만으로 구성된 요약, "AI 답변 생성 중 오류" 안내)으로 대체하고 파이프라인은 계속 진행 |
| 챗봇 초기화 실패 | HTTP 503 + 사용자 안내 메시지, 진단 관련 API는 영향받지 않음 |
| RAG 검색 자체 실패(ChromaDB collection query 오류) | `found=False` 반환, 해당 근거 없이 나머지 진단/답변 로직은 계속 진행 |
| PDF LLM 요약 실패 | 규칙 기반 정리본으로 계속 진행(진단 중단 없음) |
| 프로필 자체 없음 / 필수값 누락 | Profile 레코드 없음 → 400 `PROFILE_REQUIRED`. 레코드는 있으나 필수 필드 누락 → 400 `PROFILE_REQUIRED_FIELDS_MISSING`(진단 자체를 FastAPI에 전달하지 않음) |
| 인증/권한 없음 | 401/403 DRF 표준 오류 |
| 리소스 없음 | 404 `NOT_FOUND` 계열 |
| 요청 제한 초과 | 429 throttle 오류 |
| 사용자 표시 메시지 | Django 공통 오류 envelope(`{data:null, error:{code, message, field_errors}, request_id}`)를 프론트 `errorPresentation.ts`가 사용자 문구로 변환 |

### 5.5 LLM 판단·계산 역할 분리 원칙

| 원칙 | 내용 |
|---|---|
| 결정론적 계산은 코드가 담당 | 청약 자격, 가점, LTV/대출/실투자금 등은 Python 규칙 로직과 JSON 데이터 테이블로 계산하며 LLM이 값을 재계산하거나 임의로 바꾸지 않는다 |
| LLM은 설명·구조화 전용 | 자유 텍스트 구조화(Node4 공고문 추출), 전략 설명 문장 생성(Node5), 요약(Node6, PDF), RAG 답변 합성에만 사용한다 |
| 계산값의 프롬프트 고정 | Node5는 이미 계산된 수치를 프롬프트에 명시하고 "다시 계산하지 말고 인용하라"고 지시해 LLM의 임의 재추정을 방지한다 |
| 참고용 지표 표현 강제 | 당첨 경쟁력 점수는 "당첨 확률"이 아닌 "참고용 경쟁력 지표"로만 표현하도록 강제한다 |

---

## 6. 산출물 간 추적성 (Traceability)

### 6.1 원칙

- 모든 기능 요구사항은 화면(URL) · 공개 API · 구현 파일 · 테스트 ID 중 최소 3개 이상과 연결되어야 한다.
- API 계약 변경 시 `docs/current/260706_VERSION1_API_RESPONSE_CONTRACT.md`, Django serializer, React 결과 화면을 함께 수정한다.
- 화면설계(`docs/frontend/SCREEN_DESIGN.md`)와 요구사항(`docs/frontend/REQUIREMENTS_TRACEABILITY.md`)의 FR/NFR ID는 이 문서의 ID와 매핑을 유지한다.

### 6.2 추적 매트릭스

| 요구사항 ID | 사용자 시나리오 | 화면·URL | 연결 API | 구현 파일 | 테스트 ID |
|---|---|---|---|---|---|
| FR-AUTH-01/02 | UC-01 | `/login` | `POST /api/auth/login`, `POST /api/auth/signup` | `pages/Login.tsx`, `auth/AuthContext.tsx`, `accounts/views.py` | TC-01 |
| FR-AUTH-03/04 | UC-08 | 전체 보호 라우트 | `GET /api/auth/me` | `auth/AuthContext.tsx`, `components/Layout.tsx` | TC-02 |
| FR-AUTH-05/06 | UC-01 | `/login` | `POST /api/auth/login`, `POST /api/auth/signup` | `accounts/views.py`(LoginRateThrottle) | TC-01 |
| FR-PROFILE-01/02 | UC-02 | `/profile` | `GET/PUT/PATCH /api/user/profile` | `pages/Profile.tsx`, `accounts/serializers.py`, `accounts/models.py` | TC-03 |
| FR-STRATEGY-01 | UC-03 | `/strategy` → `/results/:id` | `POST /api/strategy` | `pages/StrategyRun.tsx`, `strategy/views.py`, `strategy/adapters.py`, `Backend/src/engine/node1~2.py` | TC-07 |
| FR-STRATEGY-02 | UC-04 | `/strategy` → `/results/:id` | `POST /api/strategy` | 동일 + `Backend/src/engine/node4~6.py` | TC-07 |
| FR-PDF-01~04 | UC-05 | `/pdf`, `/strategy` | `POST /api/pdf/analyze` | `pages/PdfAnalysis.tsx`, `strategy/views.py`, `Backend/app/services/pdf_service.py` | TC-07 |
| FR-HIST-01/02 | UC-06 | `/mypage`, `/results/:id` | `GET /api/strategy/me`, `GET /api/strategy/{id}` | `pages/MyPage.tsx`, `pages/ResultDetail.tsx`, `announcementPresentation.ts` | 수동-01 |
| FR-CHAT-01~03 | UC-07 | 우측 패널, `/chatbot` | `POST /api/chatbot` | `components/ChatbotPanel.tsx`, `Backend/app/routers/chat_router.py`, `Backend/src/rag/chat_graph.py` | TC-05 |
| FR-ERR-01 | 전체 | 전체 | 공통 오류 envelope | `api/errorPresentation.ts`, `common/exceptions.py`, `common/renderers.py` | TC-04 |
| NFR-UI-01~04 | UC-01~08 | 전체 | - | `SCREEN_DESIGN.md` 2·6장, Tailwind 설정 | TC-06, 수동-02/03 |
| NFR-SEC-01~07 | UC-01, UC-08 | 전체 | 인증 전체 | `common/authentication.py`, `config/settings.py` | TC-02, TC-04, 보안 테스트(미완료) |
| NFR-RELIAB-01~05 | UC-03~07 | `/strategy`, 챗봇 | `/api/simulate`, `/api/announcement`, `/api/chat` | `llm_safety.py`, `chat_service.py`, `pipeline.py` | 수동 검증(회귀 테스트 미구현) |
| NFR-DEPLOY-01~06 | 전체(운영) | - | - | 루트 `README.md`, `.env.example` | 없음(미완료 항목) |

### 6.3 현재 추적성 갭

| 갭 | 내용 | 후속 조치 |
|---|---|---|
| 배포 환경 검증 부재 | Docker/CI가 없어 NFR-DEPLOY 항목은 코드·문서 수준에서만 확인 가능 | Docker Compose, CI 파이프라인 구축 후 테스트 ID 부여 |
| 프론트 자동 테스트 수준 | 현재 7건은 소스 계약 회귀 테스트이며 실제 DOM/네트워크 모킹 테스트가 아님(NFR-TEST-02) | Testing Library/Vitest 또는 Playwright 도입 |
| 운영 보안 회귀 테스트 부재 | 표준 CSRF 적용 전이라 관련 테스트 ID 없음(NFR-SEC-05) | CSRF 전환 후 보안 회귀 테스트 추가 |
| LLM 장애 시나리오 자동화 부재 | `safe_llm_call` fallback, 챗봇 503 등은 코드 리뷰로만 확인됨(NFR-RELIAB) | LLM mock 기반 장애 주입 테스트 추가 |
| 응답 형태 이원화 | FastAPI `result_payload`가 최상위에도 펼쳐지는 과도기 상태로, 두 형태를 프론트가 모두 처리 중 | Result adapter 단일화 후 계약 문서·테스트 갱신 |

---

## 7. MVP 범위 및 우선순위

| 기능 | 상태 |
|---|---|
| 회원가입·로그인·로그아웃 | 완료 |
| 프로필 조회·저장·수정 | 완료 |
| 기본 프로필 진단 | 완료 |
| 수동 공고문 기반 진단 | 완료 |
| PDF 업로드 기반 진단 | 완료 |
| 결과 목록·상세 조회 | 완료 |
| RAG 챗봇 | 완료 |
| Result 응답 adapter 단일화 | 미완료 |
| 표준 CSRF 적용 | 미완료 |
| Docker Compose / CI / 배포 환경 | 미완료 |
| PostgreSQL/RDS 전환 | 미완료(계획 단계) |

---

## 8. 미해결 이슈 (참고)

| 이슈 | 내용 |
|---|---|
| `/api/profile` 간헐적 10초 타임아웃 | 재현 조건 불명확, 근본 원인 미확인. 재발 시 상세 로그 조사 필요 |
| 회원가입 400 오류 메시지 부정확 | 실제 원인(예: 비밀번호가 이메일과 유사)과 무관한 일반 문구 표시. `common/exceptions.py` fallback 메시지 수정 필요 |
| `rag_tools.py` 코드 중복 | 리팩토링 과정에서 이전/신규 코드가 동시에 남아 있음. 정리 필요 |
| `strategy_tools.py`와 `node2.py` 임계값 중복 | `COMPETITIVENESS_THRESHOLD` 등 동일 상수가 두 곳에 존재해 한쪽만 변경 시 결과 불일치 위험 |

---

## 부록 A. ID 매핑표

이 문서의 도메인 접두어 ID와 프론트 요구사항 추적표(`docs/frontend/REQUIREMENTS_TRACEABILITY.md`)의 기존 ID는 1:1로 대응한다. 본문 표에서는 가독성을 위해 이 문서의 ID만 표기하고, 대응 관계는 아래 표로 한 번만 정리한다.

| 이 문서 ID | 프론트 추적표 ID |
|---|---|
| FR-AUTH-01 | FR-01 |
| FR-AUTH-02 | FR-02 |
| FR-AUTH-03 | FR-03 |
| FR-AUTH-04 | FR-04 |
| FR-PROFILE-01 | FR-05 |
| FR-PROFILE-02 | FR-06 |
| FR-STRATEGY-01 | FR-07 |
| FR-STRATEGY-02 | FR-08 |
| FR-HIST-01 | FR-09 |
| FR-PDF-01 | FR-10 |
| FR-CHAT-01 | FR-11 |
| FR-CHAT-02 | FR-12 |
| FR-ERR-01 | FR-13 |
| NFR-UI-01 | NFR-01 |
| NFR-PERF-06 | NFR-02 |
| NFR-PERF-05 | NFR-03 |
| NFR-SEC-01 | NFR-04 |
| NFR-SEC-04 | NFR-05 |
| NFR-UI-03 | NFR-06 |
| NFR-TEST-01 | NFR-07 |
| NFR-TEST-02 | NFR-08 |
| NFR-SEC-05 | NFR-09 |

이 표에 없는 ID(예: FR-AUTH-05~07, FR-STRATEGY-03~06, NFR-RELIAB-\*, NFR-DEPLOY-\* 등)는 이 문서에서 새로 도출한 요구사항으로, 프론트 추적표에는 대응 항목이 없다.

---

## 9. 변경 이력

| 버전 | 일자 | 내용 |
|---|---|---|
| 0.1 | 2026-07-07 | 최초 작성. `docs/` 전체 문서(current/traces/frontend/guides/reports) 검토 후 기능·비기능·LLM 연동·사용자 시나리오·추적성 섹션 구성 |
| 0.2 | 2026-07-07 | 실제 소스 코드(Django `accounts`/`strategy`, FastAPI `Backend/app`·`Backend/src`, React `frontend-react`) 대조 검증 완료. `PROFILE_REQUIRED`(프로필 없음)와 `PROFILE_REQUIRED_FIELDS_MISSING`(필수 필드 누락)이 서로 다른 오류 코드임을 반영, FastAPI 응답 지연은 502가 아닌 504 `FASTAPI_TIMEOUT`으로 별도 처리됨을 반영. 그 외 timeout 값·throttle 비율·PDF 상수·테스트 건수(Django 27건, React 7건)·`safe_llm_call`·`SqliteSaver`·챗봇 503 처리·`interrupt`/`Command(resume=...)` 등은 코드와 일치 확인 |
| 0.3 | 2026-07-07 | 외부 검토(GPT) 피드백 반영. 3~4장 FR/NFR 표에 MoSCoW 우선순위 열 추가, 요구사항 문장에서 구현 상세(`isRunning`, `AbortController`, `SqliteSaver` 등)를 분리해 별도 "구현 참고" 열로 이동, 3.8절에 핵심 요구사항(인증·진단 실행·PDF·챗봇) 인수 기준(Acceptance Criteria) 추가, NFR-UI-01/02에 Tailwind 기본 breakpoint 실제 px 값(`sm 640/md 768/lg 1024/xl 1280/2xl 1536`) 반영 |
| 0.4 | 2026-07-07 | 1.1절에 시스템 아키텍처 Mermaid 다이어그램, 2.9절에 전략 진단/PDF 분석/챗봇 3개 핵심 흐름 시퀀스 다이어그램 추가. 본문 표 전반에서 "FR-AUTH-01 (FR-01)"처럼 반복되던 이중 ID 표기를 제거하고, 이 문서 ID만 표기하도록 정리. 기존 프론트 추적표 ID와의 대응 관계는 부록 A로 이동해 한 곳에서만 관리 |
