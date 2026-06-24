# 청약 진단 React 스켈레톤

피그마에서 생성한 UI를 기반으로, Django 공개 API 연결을 확인하기 위한 React/Vite 스켈레톤입니다.

## 실행

```bash
npm install
npm run dev
```

일반 PowerShell에서 `node` 명령을 찾지 못하는 경우 Codex 번들 Node 경로를 포함한 스크립트를 사용합니다.

```powershell
C:\Users\Playdata\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd install
C:\Users\Playdata\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd run dev:codex
```

빌드 확인도 같은 방식으로 실행할 수 있습니다.

```powershell
C:\Users\Playdata\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd run build:codex
```

## 기본 동작

기본값은 mock/fixture 모드입니다.

- fixture 위치: `src/app/fixtures`
- API 계층: `src/app/api/client.ts`
- 화면 이벤트는 `api.*` 함수를 호출합니다.
- Django가 없어도 프로필, 전략 진단, 결과 상세, PDF 분석, 챗봇 흐름을 확인할 수 있습니다.

## Django 연결 확인

Django 서버를 실제로 호출하려면 `.env.local`을 추가합니다.

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:8000
```

경로 기준:

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/user/profile`
- `PUT /api/user/profile`
- `PATCH /api/user/profile`
- `POST /api/strategy`
- `GET /api/strategy/me`
- `GET /api/strategy/{strategy_id}`
- `POST /api/chatbot`
- `POST /api/pdf/analyze`

## 주의

- `/api/v1/...`는 사용하지 않습니다.
- 챗봇 이력 저장 API는 만들지 않습니다.
- 챗봇 대화는 현재 화면의 React state로만 유지됩니다.
- PDF 업로드는 `FormData`로 전송되며, JSON `Content-Type`을 강제로 붙이지 않습니다.
