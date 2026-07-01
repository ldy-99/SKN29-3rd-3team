# React 스켈레톤 코드 흐름

이 문서는 `frontend-react` 스켈레톤을 빠르게 파악하기 위한 코드 읽기 가이드입니다. Django 프로토타입과 연결할 때는 `src/app/api/client.ts`를 중심으로 보면 됩니다.

## 1. 전체 구조

```text
frontend-react/
  src/
    main.tsx                  # React 앱 진입점
    app/
      App.tsx                 # RouterProvider 연결
      routes.tsx              # 화면 라우팅 정의
      api/client.ts           # Django API 연결과 fixture fallback
      components/
        Layout.tsx            # 좌측 메뉴 + 본문 + 우측 챗봇 레이아웃
        ChatbotPanel.tsx      # 우측 고정 챗봇 패널
        UI.tsx                # 공통 UI 컴포넌트
      pages/
        Login.tsx             # 로그인/회원가입
        Profile.tsx           # 프로필 조회/저장/일부 수정
        StrategyRun.tsx       # 전략 진단 실행
        ResultDetail.tsx      # 전략 상세 조회
        PdfAnalysis.tsx       # PDF 분석
      fixtures/               # Django 없이 확인할 mock JSON
```

## 2. 실행 흐름

1. `src/main.tsx`
   - `createRoot(...).render(<App />)`로 앱을 시작합니다.

2. `src/app/App.tsx`
   - `RouterProvider`에 `router`를 연결합니다.

3. `src/app/routes.tsx`
   - `/login`은 단독 로그인 화면입니다.
   - `/` 아래 화면은 `Layout`을 공통 레이아웃으로 사용합니다.
   - `/profile`, `/strategy`, `/results/:id`, `/pdf`가 현재 주요 화면입니다.

4. `src/app/components/Layout.tsx`
   - 좌측 사이드바, 중앙 본문, 우측 챗봇 패널을 배치합니다.
   - 중앙 본문은 `<Outlet />`으로 현재 라우트 화면을 렌더링합니다.
   - 우측 `ChatbotPanel`은 로그인 이후 화면에서 계속 고정됩니다.

## 3. 라우팅 기준

| 경로 | 컴포넌트 | 역할 |
|---|---|---|
| `/login` | `Login` | 로그인/회원가입 |
| `/profile` | `Profile` | 사용자 프로필 조회, 전체 저장, 일부 수정 |
| `/strategy` | `StrategyRun` | 전략 진단 실행 |
| `/results/:id` | `ResultDetail` | 전략 진단 상세 결과 |
| `/pdf` | `PdfAnalysis` | PDF 공고 분석 |

현재 `/results`는 목록 화면이 아니라 `/strategy`로 redirect됩니다. 목록 화면이 필요하면 `StrategyListPage`를 추가하고 `GET /api/strategy/me`를 연결하면 됩니다.

## 4. API Client 핵심

파일: `src/app/api/client.ts`

모든 화면은 직접 `fetch`를 호출하지 않고 `api.*` 함수만 사용합니다. Django 연결 범위를 이 파일로 제한하기 위한 구조입니다.

### 환경 변수

```env
VITE_USE_MOCK_API=true
VITE_API_BASE_URL=http://localhost:8000
```

| 값 | 의미 |
|---|---|
| `VITE_USE_MOCK_API=true` 또는 미설정 | fixture만 사용 |
| `VITE_USE_MOCK_API=false` | 실제 Django API 호출 |
| `VITE_API_BASE_URL` | Django 서버 주소 |

### `request<T>()`

```ts
async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T>
```

역할:
- mock 모드면 `mockData`를 바로 반환합니다.
- 실제 모드면 `fetch(API_BASE_URL + endpoint)`를 호출합니다.
- 요청에는 `credentials: "include"`가 들어갑니다. Django session cookie 인증을 고려한 설정입니다.
- `FormData` 요청이면 `Content-Type: application/json`을 붙이지 않습니다. PDF 업로드용입니다.
- 실제 API 호출이 실패해도 `mockData`가 있으면 fixture로 fallback합니다.

주의:
- Django 연결 오류를 명확히 보고 싶으면 fallback 정책을 나중에 끌 수 있습니다.
- 현재는 프로토타입 확인을 우선해서 fallback을 유지합니다.

### `unwrapMock<T>()`

```ts
function unwrapMock<T>(payload: unknown): T
```

역할:
- `{ data, error, request_id }` envelope가 있으면 `data`만 꺼냅니다.
- envelope가 없는 단순 fixture는 그대로 반환합니다.

## 5. API 함수 목록

| 함수 | 실제 경로 | 사용 화면 |
|---|---|---|
| `api.login()` | `POST /api/auth/login` | `Login.tsx` |
| `api.signup()` | `POST /api/auth/signup` | `Login.tsx` |
| `api.logout()` | `POST /api/auth/logout` | `Layout.tsx` |
| `api.getProfile()` | `GET /api/user/profile` | `Profile.tsx` |
| `api.saveProfile()` | `PUT /api/user/profile` | `Profile.tsx` |
| `api.patchProfile()` | `PATCH /api/user/profile` | `Profile.tsx` |
| `api.runStrategy()` | `POST /api/strategy` | `StrategyRun.tsx` |
| `api.getMyStrategies()` | `GET /api/strategy/me` | 아직 화면 미연결 |
| `api.getStrategy()` | `GET /api/strategy/{strategy_id}` | `ResultDetail.tsx` |
| `api.askChatbot()` | `POST /api/chatbot` | `ChatbotPanel.tsx` |
| `api.analyzePdf()` | `POST /api/pdf/analyze` | `PdfAnalysis.tsx` |

## 6. 화면별 흐름

### `Login.tsx`

중요 함수:

```ts
handleSubmit(e)
```

흐름:
1. form에서 `email`, `password`를 읽습니다.
2. 로그인 모드면 `api.login()`을 호출합니다.
3. 회원가입 모드면 `api.signup()`을 호출합니다.
4. 성공하면 `/profile`로 이동합니다.
5. 실패하면 화면에 error 메시지를 표시합니다.

### `Profile.tsx`

중요 함수:

```ts
useEffect(() => api.getProfile())
saveProfile()
handlePatch()
handleSave(e)
```

흐름:
1. 화면 진입 시 `api.getProfile()`로 프로필 fixture 또는 Django 응답을 가져옵니다.
2. 상단 `저장하기`는 `api.saveProfile()`을 호출합니다.
3. `일부 수정 확인`은 `api.patchProfile()`을 호출합니다.
4. 현재 form 값 전체를 state에 반영하는 단계는 아직 최소 구현입니다.

주의:
- 지금은 연결 확인용 스켈레톤이라 입력 필드를 완전한 controlled form으로 만들지 않았습니다.
- 실제 구현 시 각 input 값을 `profile` state에 반영해야 합니다.

### `StrategyRun.tsx`

중요 함수:

```ts
handleRun()
```

흐름:
1. 공고 텍스트 또는 기본 진단 여부를 확인합니다.
2. `api.runStrategy({ announcement_text, profile_only })`를 호출합니다.
3. 응답의 `strategy_id`로 `/results/{strategy_id}` 이동합니다.

### `ResultDetail.tsx`

중요 함수:

```ts
useEffect(() => api.getStrategy(id))
```

흐름:
1. URL의 `id`를 읽습니다.
2. `api.getStrategy(id)`로 상세 결과를 조회합니다.
3. `status`, `overall_analysis_status`, `missing_fields_by_supply_type`를 화면에 표시합니다.

### `PdfAnalysis.tsx`

중요 함수:

```ts
handleUpload()
```

흐름:
1. 업로드 박스를 클릭하면 `api.analyzePdf()`를 호출합니다.
2. 응답의 `extracted` 필드를 화면에 표시합니다.
3. `needs_review`가 있으면 확인 필요 상태로 보여줍니다.

주의:
- 현재는 실제 파일 선택 input이 아니라 연결 확인용 클릭 트리거입니다.
- Django PDF API가 준비되면 `<input type="file">`을 추가하고 `api.analyzePdf(file)`로 넘기면 됩니다.

### `ChatbotPanel.tsx`

중요 함수:

```ts
getContextMessage()
getRecommendedQuestions()
handleSend(text)
scrollToBottom()
```

흐름:
1. 현재 URL에 따라 안내 문구와 추천 질문을 바꿉니다.
2. 사용자가 질문을 보내면 화면 state에 사용자 메시지를 추가합니다.
3. `api.askChatbot()`을 호출합니다.
4. 응답을 챗봇 메시지로 추가합니다.
5. 대화는 React state에만 있고 DB에 저장하지 않습니다.

주의:
- 현재 `strategy_id`는 fixture ID로 고정되어 있습니다.
- 실제 결과 상세와 연결하려면 현재 선택된 strategy ID를 context나 URL에서 전달해야 합니다.

## 7. Django 연결 시 확인할 것

### 1. CORS/CSRF

현재 요청은 `credentials: "include"`를 사용합니다. Django session cookie 인증을 쓰면 아래 처리가 필요합니다.

- `localhost:5173` CORS 허용
- CSRF cookie 발급
- 상태 변경 요청에서 CSRF token 헤더 처리

현재 스켈레톤에는 CSRF token 자동 추출 로직이 없습니다. Django가 CSRF를 강제하면 `client.ts`에 `X-CSRFToken` 처리를 추가해야 합니다.

### 2. 응답 envelope

권장 응답 형식:

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

`client.ts`는 이 형식이면 `data`만 꺼내 화면에 넘깁니다.

### 3. PDF 업로드

`api.analyzePdf(file)`은 `FormData`를 사용합니다. 이 요청에는 JSON `Content-Type`을 강제로 붙이면 안 됩니다.

## 8. 충돌을 줄이기 위한 경계

- Django 작업자는 `backend/` 또는 Django 전용 폴더에서 작업합니다.
- React 프로토타입은 `frontend-react/` 안에서만 작업합니다.
- API 경로가 바뀌면 우선 `src/app/api/client.ts`만 수정합니다.
- 화면이 필요로 하는 fixture는 `src/app/fixtures/`에 추가합니다.
- 기존 Streamlit UI는 4차 React 통합 후 제거되었으며 `frontend-react/`만 사용합니다.

## 9. 다음 구현 후보

우선순위가 높은 보완:

1. `Profile.tsx` 입력값을 실제 `profile` state와 연결
2. `StrategyList` 화면 추가 후 `api.getMyStrategies()` 연결
3. PDF 화면에 실제 file input 추가
4. CSRF token 처리 추가
5. 챗봇의 `strategy_id`를 현재 결과 상세 URL과 연결

