# React Frontend

Vite, React, TypeScript 기반 사용자 화면입니다.

```text
src/app/api/          Django API client
src/app/components/   공통 UI와 챗봇
src/app/pages/        프로필, 전략 실행, 결과, PDF, 로그인
src/app/fixtures/     mock API 응답
```

개발 명령:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
pnpm.cmd run build
```

실제 Django 연결:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

전체 실행 순서는 [로컬 실행 가이드](../docs/LOCAL_SETUP.md), 공개 요청·응답은 [API 계약](../docs/API_CONTRACT.md)을 기준으로 합니다.
