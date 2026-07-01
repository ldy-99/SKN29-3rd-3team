# React-Django 통합 작업 이력

작성일: 2026-06-26  
대상 브랜치: `review/react-django-integration`  
작업 위치: `4th_project/branching/react-django-integration`

## 0. 핵심 원칙

이번 통합 작업은 3차 프로젝트의 FastAPI/RAG/LLM 핵심 로직을 최대한 건드리지 않는 것을 전제로 진행한다.

우리가 우선 지키는 기준은 다음과 같다.

| 원칙 | 내용 |
|---|---|
| FastAPI/RAG 최소 변경 | 기존 `Backend/`의 AI, RAG, LangGraph, 계산 로직은 최대한 그대로 둔다. |
| Django는 중간 API 서버 | React가 FastAPI를 직접 호출하지 않고 Django 공개 API를 호출하게 한다. |
| React는 `client.ts` 중심 | 화면 컴포넌트에서 직접 `fetch`를 늘리지 않고 `frontend-react/src/app/api/client.ts`를 기준으로 연결한다. |
| 계약 우선 | 충돌이 있으면 `docs/4th_docs/01_API_데이터_계약_명세.md`와 `fixture_examples/`를 기준으로 판단한다. |
| 불일치는 Django 어댑터에서 흡수 | 4차 공개 API와 3차 FastAPI 입력이 다르면 Django에서 변환한다. |
| 작업 로그 유지 | 이후 수정 사항은 이 문서에 계속 추가해 팀원이 변경 이유를 추적할 수 있게 한다. |

## 1. 브랜치 수령 및 초기 확인

### 수행 내용

GitHub 브랜치 `review/react-django-integration`을 아래 위치에 clone했다.

```text
C:\SKN_29th\python-src\ex\02_unit_projects\SKN_Project\4th_project\branching\react-django-integration
```

브랜치 수령 후 확인한 주요 구조는 다음과 같다.

```text
react-django-integration/
  Backend/           # 기존 FastAPI/RAG/LangGraph/계산 로직
  Frontend/          # 기존 Streamlit 프론트
  django_backend/    # 새 Django 백엔드 prototype
  frontend-react/    # 새 React/Vite 프론트 prototype
  fixture_examples/  # 4차 공개 API 계약 fixture
  docs/4th_docs/     # 4차 명세 문서
```

### 판단

기존 Streamlit 구조는 아직 남아 있다. 하지만 4차 통합의 주 작업 대상은 `frontend-react/`와 `django_backend/`이며, `Backend/`는 Django가 내부적으로 호출하는 FastAPI/RAG 엔진으로 본다.

## 2. 기준 문서 확인

### 확인한 문서

| 문서 | 역할 |
|---|---|
| `4th_project/documents/workthrough/0625/DJANGO_INTEGRATION_GUIDE.md` | React-Django prototype 연결 가이드 |
| `django_backend/README.md` | Django 백엔드 역할 및 API 설명 |
| `frontend-react/README_Codex.md` | React prototype 실행 및 API 연결 방식 |
| `docs/4th_docs/01_API_데이터_계약_명세.md` | 4차 공개 API, 필드명, 응답 envelope 기준 |
| `fixture_examples/README.md` | 계약 테스트 fixture 설명 |

### 문서 기준 핵심

React는 다음 Django 공개 API를 호출한다.

```text
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/logout
GET  /api/user/profile
PUT  /api/user/profile
PATCH /api/user/profile
POST /api/strategy
GET  /api/strategy/me
GET  /api/strategy/{strategy_id}
POST /api/chatbot
POST /api/pdf/analyze
```

공통 응답 형식은 다음 envelope를 기준으로 한다.

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

## 3. 초기 실행 환경 구성

### Django

`django_backend` 안에 새 가상환경을 만들었다.

```powershell
cd django_backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

이후 다음 명령으로 기본 검증을 진행했다.

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
```

### React

React는 프로젝트의 `pnpm-lock.yaml`을 기준으로 설치했다. 기본 시스템 Node가 낮아 Vite build가 실패했기 때문에 Codex 런타임의 Node 24를 PATH 앞에 두고 실행했다.

```powershell
$env:PATH="C:\Users\임준억\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;" + $env:PATH
pnpm install
pnpm approve-builds --all
pnpm run build
```

### FastAPI

FastAPI/RAG 실행은 기존 3차 프로젝트의 `.venv`에 관련 패키지가 이미 있어, 새로 설치하지 않고 기존 venv를 사용했다.

```powershell
C:\SKN_29th\python-src\ex\02_unit_projects\SKN_Project\3rd_project\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8080
```

## 4. 변경 이력

### 4.1 Django requirements 보완

변경 파일:

```text
django_backend/requirements.txt
```

변경 내용:

```text
requests>=2.31.0
```

이유:

`django_backend/strategy/services.py`에서 FastAPI 호출에 `requests`를 사용하고 있었지만 requirements에 빠져 있었다. 새 환경에서 설치할 경우 Django 서버가 import 단계에서 실패할 수 있어 명시적으로 추가했다.

### 4.2 React 인증 요청과 Django 인증 serializer 불일치 수정

변경 파일:

```text
django_backend/accounts/serializers.py
```

문제:

React 로그인/회원가입 화면은 다음 payload를 보낸다.

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

하지만 기존 Django serializer는 `username`을 필수로 기대했다.

수정:

| 항목 | 변경 |
|---|---|
| 회원가입 | `username`을 선택값으로 바꾸고, 없으면 `email`을 username으로 사용 |
| 로그인 | `email` 또는 `username`을 받을 수 있게 처리 |
| 인증 | email만 들어오면 해당 email의 user를 찾아 Django `authenticate(username, password)`로 인증 |

이유:

React 화면이 email 기반 인증 UI로 만들어져 있어 Django가 이 계약을 받아주는 편이 더 자연스럽다. React 화면 파일을 여러 곳 수정하는 대신 Django 공개 API 계층에서 흡수했다.

### 4.3 Profile 추가 필드 반영

변경 파일:

```text
django_backend/accounts/models.py
django_backend/accounts/serializers.py
django_backend/accounts/migrations/0002_profile_dependent_family_count_and_more.py
```

문제:

4차 API 계약에는 P0 필드 외 조건부/추가 진단 필드가 있다.

예:

```text
residence_period_years
homeless_period_years
marriage_period_years
monthly_household_income_krw
total_assets_krw
dependent_family_count
has_income_tax_5_years
real_estate_assets_krw
vehicle_value_krw
```

하지만 기존 Django Profile model/serializer는 P0 중심 필드만 가지고 있었다.

수정:

Profile model과 serializer에 추가 필드를 반영했다. nullable 필드는 `null`을 그대로 보존하도록 `null=True, blank=True`로 두었다.

이유:

문서의 null 정책은 `null`, `0`, `false`, omitted를 구분한다. 사용자가 모르는 값은 0이나 false로 바꾸면 안 되므로 Django DB에서도 null을 받을 수 있어야 한다.

### 4.4 Strategy 요청 계약 보완

변경 파일:

```text
django_backend/strategy/serializers.py
django_backend/strategy/views.py
```

문제:

문서와 fixture 기준 `/api/strategy` 요청은 top-level 형태다.

```json
{
  "announcement_text": "...",
  "pdf_analysis_id": null
}
```

하지만 기존 Django serializer는 nested announcement 형태를 기대했다.

```json
{
  "announcement": {
    "announcement_text": "..."
  }
}
```

수정:

`StrategyRequestSerializer`에서 다음 필드를 추가로 받도록 했다.

```text
announcement_text
pdf_analysis_id
profile_only
```

그리고 nested `announcement`가 없을 때도 top-level `announcement_text`를 FastAPI 호출에 사용할 수 있게 했다.

이유:

React와 fixture가 top-level 계약을 기준으로 만들어져 있다. Django가 nested만 받으면 React 화면에서 전략 진단이 바로 실패한다.

### 4.5 Strategy 응답에 `strategy_id` 추가 및 result payload 펼침

변경 파일:

```text
django_backend/strategy/serializers.py
```

문제:

React `StrategyRun.tsx`는 전략 실행 후 다음과 같이 결과 상세 화면으로 이동한다.

```ts
navigate(`/results/${result.strategy_id}`);
```

하지만 기존 Django serializer는 `id`만 내려주고 `strategy_id`는 내려주지 않았다.

수정:

`StrategyRunSerializer`에 `strategy_id`를 추가했다.

또한 FastAPI 결과가 `result_payload` 안에만 있으면 React 결과 화면에서 쓰기 어렵기 때문에, `result_payload`의 top-level key를 Django 응답 top-level에도 일부 노출하도록 했다.

이유:

React fixture는 `strategy_id`, `status`, `overall_analysis_status` 같은 top-level 데이터를 기대한다. 현재 FastAPI 실제 응답은 fixture와 완전히 같지 않지만, 최소한 React가 상세 화면으로 이동할 수 있는 기준값은 맞춰야 한다.

### 4.6 Django -> FastAPI 전략 진단 호출 순서 수정

변경 파일:

```text
django_backend/strategy/services.py
django_backend/strategy/tests.py
```

문제:

FastAPI LangGraph 파이프라인은 다음 순서를 기대한다.

```text
1. POST /api/profile
2. POST /api/simulate
3. POST /api/announcement
```

상세 공고 진단인 경우:

```text
profile -> simulate(True) -> announcement
```

기존 Django 호출 순서는 다음과 같았다.

```text
profile -> announcement -> simulate
```

또 다른 문제는 FastAPI가 `/api/profile` 응답에서 발급한 `session_id`를 Django가 사용하지 않고, Django의 `strategy_run.id`를 FastAPI 후속 호출에 사용했다는 점이다. 이 경우 LangGraph 메모리 thread가 이어지지 않는다.

수정:

`FastAPIClient.run_diagnosis()`를 다음 흐름으로 바꿨다.

```text
send_profile(profile)
  -> FastAPI session_id 확보

announcement_text가 있으면:
  trigger_simulate(fastapi_session_id, True)
  send_announcement(fastapi_session_id, announcement_text)

announcement_text가 없으면:
  trigger_simulate(fastapi_session_id, False)
```

테스트도 추가했다.

```text
FastAPIClientFlowTests
  - 공고문이 있는 경우 profile -> simulate(True) -> announcement 순서 검증
  - 공고문이 없는 경우 profile -> simulate(False) 순서 검증
  - Django run id 대신 FastAPI session_id를 쓰는지 검증
```

이유:

FastAPI/RAG 로직은 건드리지 않고, Django 프록시 계층에서 FastAPI가 기대하는 상태 전이 순서를 맞추기 위함이다.

### 4.7 pnpm build script 승인 설정 추가

변경 파일:

```text
frontend-react/pnpm-workspace.yaml
```

수정:

```yaml
allowBuilds:
  '@tailwindcss/oxide': true
  esbuild: true
```

이유:

`pnpm install` 시 `@tailwindcss/oxide`, `esbuild`의 build script가 승인되지 않아 설치가 경고/실패 상태가 되었다. 문서에도 승인 필요 항목으로 언급되어 있어 workspace 설정에 명시했다.

## 5. 현재 검증 결과

### Django

```text
python manage.py check
결과: 통과
```

```text
python manage.py test
결과: 22 tests OK
```

### React

```text
pnpm run build
결과: 통과
```

주의:

시스템 기본 Node는 낮아 Vite build가 실패했다. Node 20 이상이 필요하며, 검증 시 Codex 런타임 Node 24를 PATH 앞에 두고 실행했다.

### FastAPI

```text
GET http://127.0.0.1:8080/health
결과: {"status": "ok"}
```

### 3서버 통합

현재 로컬에서 다음 서버를 띄워 검증했다.

```text
React   http://127.0.0.1:5173
Django  http://127.0.0.1:8000
FastAPI http://127.0.0.1:8080
```

검증한 흐름:

| 흐름 | 결과 |
|---|---|
| React 대상 Django 회원가입 payload와 Django serializer 계약 | 성공 |
| Django `/api/user/profile` 저장 | 성공 |
| Django `/api/chatbot` -> FastAPI `/api/chat` | 성공 |
| Django `/api/strategy` -> FastAPI profile/simulate/announcement | 성공 |
| Strategy 최종 result_payload | `status=success`, `report` 존재 |

## 6. 현재 남은 이슈

### 6.1 PDF 분석 endpoint 공백

문서에는 `POST /api/pdf/analyze`가 P0로 정의되어 있다.

Django에는 다음 endpoint가 있다.

```text
django_backend/strategy/views.py
PDFAnalyzeAPIView
```

하지만 FastAPI `Backend/` 쪽에는 `/api/pdf/analyze` 라우터가 아직 보이지 않는다.

따라서 현재 상태에서는 Django PDF endpoint가 실제 FastAPI 분석 서버까지 정상 연결되기 어렵다.

판단이 필요한 선택지:

| 선택지 | 설명 |
|---|---|
| FastAPI에 `/api/pdf/analyze` 추가 | 문서 P0를 실제 구현한다. |
| MVP에서는 수동 공고 입력 fallback 우선 | PDF 화면은 mock/fixture 유지, 전략 진단은 수동 `announcement_text`로 진행한다. |

### 6.2 React 결과 화면과 실제 FastAPI 응답 스키마 불일치

React fixture는 다음 필드를 기대한다.

```text
overall_analysis_status
announcement_confirmed
missing_fields_by_supply_type
warnings
```

현재 FastAPI 실제 응답은 다음 구조에 가깝다.

```text
status
session_id
report
profile
announcement
available_supply_types
supply_analysis
supply_rank
recommended_supply
node5
node6
```

따라서 React 결과 화면을 실제 응답에 맞추거나, Django에서 fixture 계약 형태로 변환하는 adapter가 필요하다.

### 6.3 React Profile 화면은 아직 검증용 성격이 강함

`Profile.tsx`는 fixture를 불러오고 저장 API는 호출하지만, 화면 입력 요소가 `profile` state와 완전히 연결된 실사용 form은 아니다.

다음 작업에서 사용자가 입력한 값이 실제 Django `ProfileSerializer` 필드로 저장되도록 바인딩해야 한다.

## 7. 2026-06-26 추가 작업: React 결과 상세 화면 실제 응답 대응

### 변경 파일

```text
frontend-react/src/app/pages/ResultDetail.tsx
```

### 문제

`/api/strategy`는 Django와 FastAPI까지 연결되어 성공하지만, React 결과 상세 화면은 fixture 응답 구조를 기준으로 작성되어 있었다.

fixture가 기대하는 대표 필드:

```text
overall_analysis_status
announcement_confirmed
missing_fields_by_supply_type
warnings
```

반면 실제 FastAPI 응답은 Django의 `result_payload` 안에 다음 구조로 들어온다.

```text
status
session_id
report
profile
announcement
available_supply_types
supply_analysis
supply_rank
recommended_supply
node5
node6
```

따라서 전략 실행은 성공해도 결과 화면이 실제 응답을 충분히 표시하지 못하거나, fixture 전용 하드코딩 UI로 보일 수 있었다.

### 수정

`ResultDetail.tsx` 안에 응답 normalizer 역할의 `buildResultViewModel()`을 추가했다.

이 함수는 다음 두 가지 응답을 모두 처리한다.

| 응답 유형 | 처리 |
|---|---|
| 기존 fixture 응답 | `overall_analysis_status`, `missing_fields_by_supply_type` 등을 그대로 사용 |
| 실제 Django/FastAPI 응답 | `result_payload.report`, `result_payload.supply_rank`, `result_payload.node5`, `result_payload.node6` 등을 화면용 view model로 변환 |

화면 변경 내용:

| 영역 | 변경 |
|---|---|
| 상단 요약 카드 | 하드코딩된 "보통" 대신 `recommended_supply` 또는 첫 번째 `supply_rank`를 표시 |
| 추천 공급유형 | 하드코딩 목록 대신 실제 `supply_rank` 배열을 표시 |
| 상세 확인 사항 | 실제 report, warnings, missing fields를 모아 표시 |
| FastAPI 원본 요약 | 디버깅을 위해 `result_payload` JSON 요약을 접을 수 있는 영역으로 표시 |
| 뒤로가기 | `/results` redirect 대신 `/strategy`로 이동 |

### 이유

현재 단계에서는 Django adapter에서 최종 fixture 형태로 완전히 변환하기 전이다. 따라서 React 결과 화면이 fixture와 실제 FastAPI 응답을 모두 견딜 수 있어야 통합 검증이 가능하다.

### 검증

React build를 실행했다.

```powershell
pnpm run build
```

결과:

```text
✓ built
```

## 8. 2026-06-26 추가 작업: React Profile 입력 form 실사용화

### 변경 파일

```text
frontend-react/src/app/pages/Profile.tsx
frontend-react/src/app/api/client.ts
```

### 문제

`Profile.tsx`는 화면에 여러 입력 요소가 있었지만, 실제 `profile` state와 충분히 연결되어 있지 않았다.

기존 상태의 문제:

| 문제 | 영향 |
|---|---|
| input/select가 `profile` state와 연결되지 않음 | 사용자가 화면에서 바꾼 값이 저장 payload에 반영되지 않음 |
| 필드 enum/value가 4차 계약과 다른 값 사용 | Django serializer 또는 FastAPI adapter와 불일치 가능 |
| 금액 단위가 화면에서 애매함 | API 계약은 원 단위 `_krw`인데 화면은 만원 단위처럼 보임 |
| 실제 API 모드에서도 실패 시 fixture fallback | 404, 500, CORS 등 연결 실패가 성공처럼 숨겨질 수 있음 |

### 수정

`Profile.tsx`에 `ProfileForm` 타입과 `defaultProfile`을 추가하고, 모든 주요 입력 요소를 controlled component로 변경했다.

반영한 주요 필드:

```text
bankbook_type
bankbook_join_date
bankbook_payment_count
bankbook_balance_krw
residence_region
is_homeless
is_household_head
household_member_count
birth_year
marital_status
minor_child_count
has_household_property_ownership_history
is_dual_income
residence_period_years
homeless_period_years
marriage_period_years
monthly_household_income_krw
total_assets_krw
dependent_family_count
young_child_count
youngest_child_age_group
has_income_tax_5_years
elderly_support_status
elderly_dependent_is_homeless
real_estate_assets_krw
vehicle_value_krw
```

값 처리 방식:

| 입력 유형 | 처리 |
|---|---|
| 빈 문자열 | `null`로 변환 |
| 숫자 입력 | `number` 또는 `null`로 변환 |
| boolean select | `true`, `false`, `null`로 변환 |
| enum select | 4차 계약의 `UPPER_SNAKE_CASE` 값 사용 |

또한 `client.ts`의 catch fallback 조건을 수정했다.

```ts
if (USE_MOCK_API && mockData !== undefined) {
  ...
}
```

이제 `VITE_USE_MOCK_API=false`인 실제 Django 연결 모드에서는 API 실패를 fixture로 숨기지 않는다.

### 이유

Profile은 전략 진단의 선행 데이터다. 화면 입력값이 실제 Django `ProfileSerializer` 필드로 정확히 저장되어야 이후 `/api/strategy`에서 FastAPI로 넘기는 adapter도 의미가 생긴다.

또한 실제 API 연결 검증 중 fallback이 살아 있으면 실패 지점이 흐려진다. 통합 단계에서는 실패를 명확히 보는 것이 더 중요하다.

### 검증

React build를 실행했다.

```powershell
pnpm run build
```

결과:

```text
✓ built
```

Profile form이 보낼 수 있는 전체 필드 payload를 Django에 직접 저장하는 HTTP 검증도 진행했다.

검증 조건:

```text
POST /api/auth/signup
PUT /api/user/profile
```

검증 payload에는 `MARRIED`, `is_dual_income=true`, 소득/자산/자녀/노부모 관련 선택 필드를 포함했다.

결과:

```text
marital_status = MARRIED
is_dual_income = true
monthly_household_income_krw = 5000000
youngest_child_age_group = UNDER_2
```

브라우저 클릭 검증은 시도했으나, 현재 브라우저 제어 도구 연결 단계에서 환경 메타데이터 오류가 발생해 진행하지 못했다. 대신 build 검증과 실제 HTTP 저장 검증으로 1차 확인했다.

## 9. 2026-06-29 추가 작업: React-Django CORS credential 오류 수정

### 변경 파일

```text
django_backend/config/settings.py
```

### 문제

React dev server(`http://127.0.0.1:5173`)에서 Django(`http://127.0.0.1:8000`)로 회원가입 요청을 보낼 때 브라우저가 CORS 오류로 차단했다.

브라우저 오류:

```text
The value of the 'Access-Control-Allow-Origin' header in the response must not be the wildcard '*'
when the request's credentials mode is 'include'.
```

원인은 React API client가 세션 쿠키 사용을 위해 다음 설정으로 요청하기 때문이다.

```ts
credentials: "include"
```

이 경우 Django가 `Access-Control-Allow-Origin: *`로 응답하면 브라우저 정책상 차단된다.

### 수정

기존 설정:

```python
CORS_ALLOW_ALL_ORIGINS = True
```

수정 후:

```python
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
]
CSRF_TRUSTED_ORIGINS = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
]
```

### 이유

Django Session Cookie 기반 인증을 쓰려면 React 요청에 credential이 포함되어야 한다. credential 요청에서는 wildcard origin을 쓸 수 없으므로 개발용 React origin을 명시했다.

### 검증

```powershell
python manage.py check
python manage.py test
```

결과:

```text
System check identified no issues
22 tests OK
```

## 10. 2026-06-29 추가 작업: 신규 사용자 프로필 404 처리

### 변경 파일

```text
frontend-react/src/app/api/client.ts
frontend-react/src/app/pages/Profile.tsx
```

### 문제

회원가입 직후 `/profile`로 이동하면 아직 Django DB에 `Profile` row가 없으므로 `GET /api/user/profile`은 404를 반환한다.

이 404는 장애가 아니라 "프로필을 처음 작성해야 하는 상태"다. 하지만 React는 모든 API 실패를 일반 `Error`로만 받아서 화면에 API 연결 오류처럼 표시했다.

### 수정

`client.ts`에 `ApiRequestError`를 추가해 HTTP status, error code, field errors를 보존하도록 했다.

`Profile.tsx`에서는 `GET /api/user/profile` 실패가 404이면 에러로 표시하지 않고 빈 form을 유지하며 안내 문구만 보여주도록 했다.

### 이유

신규 사용자의 첫 프로필 작성 플로우는 정상 사용자 경로다. 404를 장애처럼 보여주면 회원가입 직후부터 사용자가 막힌 것처럼 느끼게 된다.

### 검증

React build를 실행했다.

```powershell
pnpm run build
```

결과:

```text
✓ built
```

## 11. 앞으로 수정할 때 기록 방식

이후 변경은 아래 형식으로 이 문서에 추가한다.

```text
## YYYY-MM-DD 작업명

### 변경 파일
- ...

### 문제
- ...

### 수정
- ...

### 이유
- ...

### 검증
- ...
```
