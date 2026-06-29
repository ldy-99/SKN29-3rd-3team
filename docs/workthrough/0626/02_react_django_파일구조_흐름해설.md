# React와 Django 파일 구조 및 흐름 해설

작성일: 2026-06-26  
대상 브랜치: `review/react-django-integration`

## 0. 이 문서의 목적

이 문서는 React와 Django 코드를 처음 보는 팀원이 다음 질문에 빠르게 답할 수 있도록 작성했다.

```text
1. 어떤 폴더가 새 4차 작업 대상인가?
2. React 화면은 어디서 시작해서 어떤 API를 부르는가?
3. Django는 어떤 URL을 받고 어떤 view/serializer/service로 이어지는가?
4. React -> Django -> FastAPI 흐름은 어떻게 연결되는가?
```

FastAPI/RAG 쪽은 이번 통합에서 최대한 건드리지 않는 영역이므로, 이 문서에서는 React와 Django 중심으로 설명한다.

## 1. 전체 구조 한눈에 보기

```text
react-django-integration/
  frontend-react/    # 새 React/Vite 프론트
  django_backend/    # 새 Django API 서버
  Backend/           # 기존 FastAPI/RAG/LangGraph 엔진
  Frontend/          # 기존 Streamlit 프론트
```

4차 통합의 기본 흐름은 다음과 같다.

```text
사용자
  -> React(frontend-react)
  -> Django(django_backend)
  -> FastAPI/RAG(Backend)
```

중요한 점:

React는 FastAPI를 직접 호출하지 않는다. React는 Django의 `/api/...`만 호출하고, Django가 내부에서 FastAPI를 호출한다.

## 2. React 구조

### 2.1 주요 폴더

```text
frontend-react/
  src/
    main.tsx
    app/
      App.tsx
      routes.tsx
      api/
        client.ts
      components/
        Layout.tsx
        ChatbotPanel.tsx
        UI.tsx
      pages/
        Login.tsx
        Profile.tsx
        StrategyRun.tsx
        ResultDetail.tsx
        PdfAnalysis.tsx
      fixtures/
        *.json
    styles/
      *.css
```

### 2.2 React 실행 시작점

```text
src/main.tsx
  -> src/app/App.tsx
  -> src/app/routes.tsx
```

`App.tsx`는 매우 얇다.

```tsx
export default function App() {
  return <RouterProvider router={router} />;
}
```

즉, 실제 화면 연결은 `routes.tsx`가 담당한다.

### 2.3 라우팅 구조

파일:

```text
frontend-react/src/app/routes.tsx
```

라우트:

| URL | 화면 파일 | 역할 |
|---|---|---|
| `/login` | `pages/Login.tsx` | 로그인/회원가입 |
| `/profile` | `pages/Profile.tsx` | 사용자 청약 프로필 조회/저장 |
| `/strategy` | `pages/StrategyRun.tsx` | 전략 진단 실행 |
| `/results/:id` | `pages/ResultDetail.tsx` | 전략 결과 상세 |
| `/pdf` | `pages/PdfAnalysis.tsx` | PDF 분석 화면 |

`/login`을 제외한 화면은 `Layout.tsx` 아래에 들어간다.

```text
Layout
  좌측 메뉴
  가운데 page outlet
  우측 ChatbotPanel
```

### 2.4 React API 호출 중심 파일

파일:

```text
frontend-react/src/app/api/client.ts
```

이 파일이 React와 Django 사이의 통신 창구다.

화면 컴포넌트는 직접 `fetch`를 호출하지 않고 아래 함수들을 사용한다.

| 함수 | Django endpoint |
|---|---|
| `api.login()` | `POST /api/auth/login` |
| `api.signup()` | `POST /api/auth/signup` |
| `api.logout()` | `POST /api/auth/logout` |
| `api.getProfile()` | `GET /api/user/profile` |
| `api.saveProfile()` | `PUT /api/user/profile` |
| `api.patchProfile()` | `PATCH /api/user/profile` |
| `api.runStrategy()` | `POST /api/strategy` |
| `api.getMyStrategies()` | `GET /api/strategy/me` |
| `api.getStrategy()` | `GET /api/strategy/{strategy_id}` |
| `api.askChatbot()` | `POST /api/chatbot` |
| `api.analyzePdf()` | `POST /api/pdf/analyze` |

### 2.5 Mock 모드와 실제 Django 모드

React는 기본적으로 fixture mock 모드로 동작한다.

실제 Django 서버를 호출하려면 다음 파일이 필요하다.

```text
frontend-react/.env.local
```

내용:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

주의:

`client.ts`에는 API 호출 실패 시 fixture로 fallback하는 코드가 있다. 연결 실패를 정확히 보고 싶을 때는 이 fallback 때문에 문제가 숨겨질 수 있다.

### 2.6 주요 화면별 흐름

#### Login.tsx

역할:

사용자 email/password를 받아 로그인 또는 회원가입 요청을 보낸다.

흐름:

```text
Login.tsx
  -> api.login({ email, password })
  -> POST /api/auth/login

Login.tsx
  -> api.signup({ email, password })
  -> POST /api/auth/signup
```

#### Profile.tsx

역할:

프로필 조회, 전체 저장, 일부 수정 API를 호출한다.

흐름:

```text
Profile.tsx
  -> api.getProfile()
  -> GET /api/user/profile

Profile.tsx
  -> api.saveProfile(profile)
  -> PUT /api/user/profile

Profile.tsx
  -> api.patchProfile(partialProfile)
  -> PATCH /api/user/profile
```

현재 상태:

화면 입력 요소는 `profile` state와 연결된 controlled component로 1차 보정했다. 빈 값은 `null`, 숫자 입력은 `number`, boolean 선택은 `true/false/null`로 변환해 Django `ProfileSerializer` 계약에 맞춰 저장한다.

#### StrategyRun.tsx

역할:

사용자가 공고문 텍스트를 입력하거나 기본 자격만 확인하기를 선택한 뒤 전략 진단을 실행한다.

흐름:

```text
StrategyRun.tsx
  -> api.runStrategy({
       announcement_text,
       profile_only
     })
  -> POST /api/strategy
  -> 성공 후 /results/{strategy_id} 이동
```

#### ResultDetail.tsx

역할:

전략 실행 결과를 조회하고 화면에 표시한다.

흐름:

```text
ResultDetail.tsx
  -> api.getStrategy(id)
  -> GET /api/strategy/{id}
```

현재 상태:

결과 화면은 fixture 응답과 실제 FastAPI 응답을 모두 처리하도록 1차 보정했다. 실제 응답은 `result_payload.report`, `result_payload.supply_rank`, `result_payload.node5`, `result_payload.node6` 중심으로 읽는다.

#### ChatbotPanel.tsx

역할:

우측 공통 챗봇 패널에서 질문을 보내고 답변을 표시한다.

흐름:

```text
ChatbotPanel.tsx
  -> api.askChatbot({ question, session_id })
  -> POST /api/chatbot
```

## 3. Django 구조

### 3.1 주요 폴더

```text
django_backend/
  manage.py
  config/
    settings.py
    urls.py
    asgi.py
    wsgi.py
  common/
    authentication.py
    exceptions.py
    middleware.py
    renderers.py
  accounts/
    models.py
    serializers.py
    views.py
    urls.py
    permissions.py
    middleware.py
    tests.py
  strategy/
    models.py
    serializers.py
    views.py
    urls.py
    adapters.py
    services.py
    tests.py
```

### 3.2 Django URL 진입점

파일:

```text
django_backend/config/urls.py
```

역할:

Django 전체 URL을 연결한다.

```text
/api/ -> accounts.urls
/api/ -> strategy.urls
```

즉 `/api/auth/login`, `/api/user/profile`, `/api/strategy` 같은 endpoint는 모두 여기서 시작해 각 app의 `urls.py`로 이어진다.

### 3.3 common 앱

```text
django_backend/common/
```

역할:

| 파일 | 역할 |
|---|---|
| `authentication.py` | 세션 인증 관련 설정 |
| `exceptions.py` | 공통 에러 응답 처리 |
| `middleware.py` | request_id 생성 |
| `renderers.py` | 응답을 `{ data, error, request_id }` envelope로 감싸기 |

이 영역 덕분에 Django API 응답이 문서의 공통 envelope 형태로 내려간다.

### 3.4 accounts 앱

```text
django_backend/accounts/
```

역할:

인증과 사용자 프로필을 담당한다.

#### models.py

주요 모델:

```text
User
Profile
```

`User`는 Django 기본 유저를 확장한 커스텀 모델이다.

`Profile`은 청약 자가진단에 필요한 사용자 입력값을 저장한다.

주요 필드:

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
```

추가 반영된 4차 조건부 필드:

```text
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

#### serializers.py

역할:

HTTP JSON과 Django model 사이를 변환하고 검증한다.

주요 serializer:

| serializer | 역할 |
|---|---|
| `ProfileSerializer` | 프로필 필드 검증 및 저장 |
| `UserSerializer` | 사용자 정보 응답 |
| `SignUpSerializer` | 회원가입 요청 검증 |
| `LoginSerializer` | 로그인 요청 검증 |

현재 React는 email/password를 보내므로, Django serializer가 email 기반 요청도 받을 수 있게 맞춰져 있다.

#### views.py

역할:

실제 HTTP 요청을 처리한다.

주요 view:

| view | endpoint | 역할 |
|---|---|---|
| `SignUpAPIView` | `POST /api/auth/signup` | 회원가입 |
| `LoginAPIView` | `POST /api/auth/login` | 로그인 |
| `LogoutAPIView` | `POST /api/auth/logout` | 로그아웃 |
| `MeAPIView` | `GET /api/auth/me` | 현재 사용자 조회 |
| `DeleteAuthAPIView` | `DELETE /api/auth` | 계정 삭제 |
| `ProfileDetailAPIView` | `GET/PUT/PATCH /api/user/profile` | 프로필 조회/저장/수정 |

### 3.5 strategy 앱

```text
django_backend/strategy/
```

역할:

전략 진단, 공고 입력, PDF 분석 프록시, 챗봇 프록시를 담당한다.

#### models.py

주요 모델:

| 모델 | 역할 |
|---|---|
| `AnnouncementInput` | 사용자가 저장한 공고 입력값 |
| `StrategyRun` | 전략 진단 실행 이력, 입력 snapshot, 결과 payload 저장 |

#### adapters.py

역할:

4차 공개 API 프로필 필드를 3차 FastAPI 계산 입력 형식으로 변환한다.

예:

| 4차 필드 | 3차/FastAPI 필드 |
|---|---|
| `bankbook_payment_count` | `bankbook_payments` |
| `bankbook_balance_krw` | `bankbook_balance` |
| `residence_region` | `region` |
| `household_member_count` | `num_household_members` |
| `has_household_property_ownership_history` | `has_property_history` |

React가 3차 필드명을 직접 알 필요가 없도록 Django가 여기서 변환한다.

#### serializers.py

주요 serializer:

| serializer | 역할 |
|---|---|
| `AnnouncementInputSerializer` | 공고 입력 검증 |
| `StrategyRunSerializer` | 전략 실행 이력 응답 |
| `StrategyRequestSerializer` | `/api/strategy` 요청 검증 |
| `ChatbotRequestSerializer` | `/api/chatbot` 요청 검증 |

`StrategyRequestSerializer`는 현재 top-level 요청과 nested announcement 요청을 모두 받을 수 있다.

```json
{
  "announcement_text": "...",
  "pdf_analysis_id": null,
  "profile_only": false
}
```

#### services.py

역할:

Django에서 내부 FastAPI 서버를 호출한다.

FastAPI 주소:

```text
http://127.0.0.1:8080
```

주요 method:

| method | FastAPI endpoint | 역할 |
|---|---|---|
| `send_profile()` | `POST /api/profile` | 프로필 전달, FastAPI session_id 확보 |
| `trigger_simulate()` | `POST /api/simulate` | 상세/간단 진단 분기 |
| `send_announcement()` | `POST /api/announcement` | 공고문 전달 |
| `call_chatbot()` | `POST /api/chat` | 챗봇 질문 전달 |
| `proxy_pdf_analysis()` | `POST /api/pdf/analyze` | PDF 분석 프록시 |

전략 진단 흐름:

```text
Django /api/strategy
  -> ProfileAdapter.to_3rd_spec()
  -> FastAPI POST /api/profile
  -> FastAPI session_id 확보
  -> 공고문이 있으면 POST /api/simulate { simulate: true }
  -> 공고문이 있으면 POST /api/announcement
  -> 공고문이 없으면 POST /api/simulate { simulate: false }
```

#### views.py

주요 view:

| view | endpoint | 역할 |
|---|---|---|
| `StrategyRunAPIView` | `POST /api/strategy` | 전략 진단 실행 |
| `StrategyRunAPIView` | `GET /api/strategy/me` | 내 전략 진단 목록 |
| `StrategyDetailAPIView` | `GET /api/strategy/{id}` | 전략 진단 상세 |
| `PDFAnalyzeAPIView` | `POST /api/pdf/analyze` | PDF 분석 프록시 |
| `AnnouncementInputAPIView` | `POST /api/user/announcement` | 공고 정보 저장 |
| `ChatbotAPIView` | `POST /api/chatbot` | 챗봇 프록시 |

## 4. 대표 요청 흐름

### 4.1 회원가입

```text
Login.tsx
  -> api.signup({ email, password })
  -> POST /api/auth/signup
  -> accounts.urls
  -> SignUpAPIView
  -> SignUpSerializer
  -> User 생성
  -> Django session login
  -> envelope 응답
```

### 4.2 프로필 저장

```text
Profile.tsx
  -> api.saveProfile(profile)
  -> PUT /api/user/profile
  -> accounts.urls
  -> ProfileDetailAPIView.put()
  -> ProfileSerializer
  -> Profile 생성 또는 업데이트
  -> envelope 응답
```

### 4.3 전략 진단

```text
StrategyRun.tsx
  -> api.runStrategy({ announcement_text, profile_only })
  -> POST /api/strategy
  -> strategy.urls
  -> StrategyRunAPIView.post()
  -> ProfileSerializer로 저장된 프로필 검증
  -> StrategyRequestSerializer로 요청 검증
  -> StrategyRun 생성
  -> ProfileAdapter로 4차 프로필을 3차 입력으로 변환
  -> FastAPIClient.run_diagnosis()
  -> FastAPI /api/profile
  -> FastAPI /api/simulate
  -> FastAPI /api/announcement 또는 간단 진단
  -> StrategyRun.result_payload 저장
  -> envelope 응답
```

### 4.4 챗봇

```text
ChatbotPanel.tsx
  -> api.askChatbot({ question, session_id })
  -> POST /api/chatbot
  -> strategy.urls
  -> ChatbotAPIView.post()
  -> ChatbotRequestSerializer
  -> FastAPIClient.call_chatbot()
  -> FastAPI /api/chat
  -> RAG 답변 반환
  -> envelope 응답
```

### 4.5 PDF 분석

```text
PdfAnalysis.tsx
  -> api.analyzePdf(file)
  -> POST /api/pdf/analyze
  -> PDFAnalyzeAPIView
  -> FastAPIClient.proxy_pdf_analysis()
  -> FastAPI /api/pdf/analyze
```

현재 주의:

Django 쪽 endpoint는 있지만 FastAPI `Backend/` 쪽 `/api/pdf/analyze` 라우터는 아직 확인되지 않았다. 따라서 PDF는 다음 작업에서 구현 여부를 결정해야 한다.

## 5. 초심자가 볼 때 기억할 것

### React에서 API 문제가 나면

먼저 이 파일을 본다.

```text
frontend-react/src/app/api/client.ts
```

여기에서 endpoint, request body, response unwrap, mock fallback을 확인한다.

실제 Django 연결 모드에서는 다음 설정을 사용한다.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

현재는 `VITE_USE_MOCK_API=false`일 때 API 실패를 fixture로 fallback하지 않도록 조정되어 있다. 연결 실패를 확인하려면 이 설정으로 테스트한다.

### Django에서 요청이 실패하면

대부분 다음 순서로 본다.

```text
urls.py
  -> views.py
  -> serializers.py
  -> models.py 또는 services.py
```

예를 들어 `/api/strategy`가 실패하면:

```text
django_backend/strategy/urls.py
django_backend/strategy/views.py
django_backend/strategy/serializers.py
django_backend/strategy/services.py
```

### FastAPI 연결이 실패하면

Django의 FastAPI 호출 위치는 여기다.

```text
django_backend/strategy/services.py
```

FastAPI 서버는 다음 주소를 기준으로 한다.

```text
http://127.0.0.1:8080
```

Django settings의 기준값:

```text
FASTAPI_API_URL = 'http://127.0.0.1:8080'
```

### 응답 형태가 이상하면

Django 공통 envelope는 여기서 처리된다.

```text
django_backend/common/renderers.py
django_backend/common/exceptions.py
```

React는 envelope의 `data`를 꺼내 쓰는 구조다.

```text
frontend-react/src/app/api/client.ts
unwrapMock()
```

## 6. 현재 다음 작업 후보

| 우선순위 | 작업 | 이유 |
|---|---|---|
| 1 | 브라우저에서 Profile 저장 실제 클릭 검증 | build는 통과했지만 실제 UX와 서버 validation 메시지를 확인해야 한다. |
| 2 | PDF 분석 방향 결정 | 문서상 P0지만 FastAPI endpoint가 비어 있다. |
| 3 | Strategy 결과 응답 adapter 고도화 | 결과 화면 1차 대응은 했지만, 장기적으로는 Django 응답 계약을 fixture 기준으로 정리하는 편이 안정적이다. |
| 4 | Profile form 세부 UX 개선 | 지역/enum 선택지, 금액 입력 보조, validation 표시를 더 다듬을 수 있다. |
