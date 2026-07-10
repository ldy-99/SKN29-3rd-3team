# React Frontend

Vite, React, TypeScript 기반 사용자 화면입니다.

```text
src/app/api/          Django API client
src/app/components/   공통 UI와 AI 어시스턴트
src/app/pages/        프로필, 전략 실행, 결과, PDF, 로그인
```

개발 명령:

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
pnpm.cmd run build
```

Django 연결:

```dotenv
# 로컬 Vite dev에서는 비워두면 vite.config.ts의 /api proxy를 사용합니다.
VITE_API_BASE_URL=
```

proxy를 쓰지 않는 환경에서는 `VITE_API_BASE_URL`에 Django API 주소를 명시합니다.

전체 실행 순서는 [루트 README](../README.md), 공개 요구사항과 API 흐름은 [최종 요구사항 정의서](../docs/final_v2/REQUIREMENTS_SPECIFICATION_FINAL.md)를 기준으로 합니다.
