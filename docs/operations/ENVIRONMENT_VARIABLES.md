# 환경변수 명세

실제 비밀값은 Git에 커밋하지 않습니다. 루트 `.env.example`을 `.env`로, `frontend-react/.env.example`을 `.env.local`로 복사해 사용합니다.

## 1. FastAPI/RAG와 Django 공용 `.env`

| 변수 | 적용 서비스 | 필수 | 개발 기본값 | 설명 |
|---|---|---:|---|---|
| `OPENAI_API_KEY` | FastAPI/RAG | 예 | 없음 | LLM, embedding, RAG 검색에 사용하는 OpenAI API 키 |
| `DJANGO_SECRET_KEY` | Django | 운영 필수 | 로컬 개발용 fallback | 세션과 서명에 사용하는 Django 비밀키 |
| `DJANGO_DEBUG` | Django | 아니오 | `true` | `true`, `false`, `1`, `0`, `yes`, `no` 사용 가능 |
| `DJANGO_ALLOWED_HOSTS` | Django | 운영 필수 | `127.0.0.1,localhost` | 쉼표로 구분한 Host 목록 |
| `DJANGO_CORS_ALLOWED_ORIGINS` | Django | 아니오 | React 로컬 주소 2종 | credentials를 허용할 정확한 origin 목록 |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Django | 아니오 | React 로컬 주소 2종 | 신뢰할 React origin 목록 |
| `FASTAPI_API_URL` | Django | 아니오 | `http://127.0.0.1:8080` | Django가 호출할 내부 FastAPI 주소 |
| `FASTAPI_REQUEST_TIMEOUT_SECONDS` | Django | 아니오 | `90` | Django의 FastAPI HTTP 요청 제한 시간 |

목록형 변수는 공백 없이 쉼표로 구분하는 방식을 권장합니다.

```dotenv
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

## 2. React `frontend-react/.env.local`

| 변수 | 필수 | 개발 기본 동작 | 설명 |
|---|---:|---|---|
| `VITE_USE_MOCK_API` | 아니오 | 미설정 시 mock 사용 | 실제 Django 호출은 반드시 `false` |
| `VITE_API_BASE_URL` | 실제 API 사용 시 예 | 빈 문자열 | Django API 주소 |

실제 통합 실행값:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Vite 변수는 빌드·개발 서버 시작 시 주입됩니다. 값을 변경하면 React 개발 서버를 다시 시작해야 합니다.

## 3. 서비스별 로딩 방식

| 서비스 | 파일 | 로딩 시점 |
|---|---|---|
| FastAPI/RAG | 루트 `.env` | RAG/LLM 모듈 import 시 `python-dotenv`가 로딩 |
| Django | 루트 `.env` | `config/settings.py` import 시 명시적으로 로딩 |
| React | `frontend-react/.env.local` | Vite 시작 또는 build 시 로딩 |

## 4. 운영 주의사항

- 운영에서는 `DJANGO_DEBUG=false`를 사용합니다.
- 운영용 `DJANGO_SECRET_KEY`는 로컬 예시값과 반드시 다르게 설정합니다.
- `DJANGO_ALLOWED_HOSTS`, CORS, CSRF origin에 `*`를 사용하지 않습니다.
- 브라우저 세션 인증을 사용하므로 React origin과 Django의 CORS/CSRF 설정이 정확히 일치해야 합니다.
- `OPENAI_API_KEY`, 실제 도메인, 배포 플랫폼 비밀값은 저장소·스크린샷·로그에 남기지 않습니다.
