# 로컬 실행 가이드

## 1. 기준 환경

| 항목 | 기준 |
|---|---|
| Python | 3.10.x 권장 |
| Node.js | 20 이상 |
| React 패키지 | pnpm |
| FastAPI | `127.0.0.1:8080` |
| Django | `127.0.0.1:8000` |
| React | `127.0.0.1:5173` |

Python 3.13은 ChromaDB와 일부 AI 패키지 호환 문제가 생길 수 있으므로 팀 공통 환경으로 사용하지 않습니다.

## 2. 새 clone 설치

```powershell
git clone <repository-url>
cd SKN29-3rd-3team
git switch final
```

Python:

```powershell
py -3.10 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r django_backend\requirements.txt
```

React:

```powershell
Push-Location frontend-react
pnpm.cmd install --frozen-lockfile
Pop-Location
```

`pnpm.ps1` 실행 정책 오류가 나면 `pnpm` 대신 `pnpm.cmd`를 사용합니다.

## 3. 환경 파일

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`:

| 변수 | 필수 | 기본값·설명 |
|---|---:|---|
| `OPENAI_API_KEY` | 예 | LLM·embedding API 키 |
| `DJANGO_SECRET_KEY` | 운영 필수 | 로컬 fallback 존재 |
| `DJANGO_DEBUG` | 아니오 | `true` |
| `DJANGO_ALLOWED_HOSTS` | 운영 필수 | `127.0.0.1,localhost` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | 아니오 | React 로컬 origin |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | 아니오 | React 로컬 origin |
| `FASTAPI_API_URL` | 아니오 | `http://127.0.0.1:8080` |
| `FASTAPI_REQUEST_TIMEOUT_SECONDS` | 아니오 | `90` |

목록형 값은 쉼표로 구분합니다.

```dotenv
OPENAI_API_KEY=your-openai-api-key
DJANGO_SECRET_KEY=change-this-in-non-local-environments
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
FASTAPI_API_URL=http://127.0.0.1:8080
FASTAPI_REQUEST_TIMEOUT_SECONDS=90
```

`frontend-react/.env.local`:

```dotenv
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

| 변수 | 설명 |
|---|---|
| `VITE_USE_MOCK_API=false` | 실제 Django API 사용 |
| `VITE_USE_MOCK_API=true` 또는 미설정 | JSON fixture 사용 |
| `VITE_API_BASE_URL` | Django 주소 |

Vite 환경값을 변경하면 React 개발 서버를 재시작합니다.

## 4. DB 준비

```powershell
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py migrate
Pop-Location
```

저장소에 SQLite 파일이 있어도 migration은 항상 실행합니다.

## 5. 서버 실행

세 개의 PowerShell을 사용합니다.

### Terminal 1 — FastAPI

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --host 127.0.0.1 --port 8080
```

확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

정상 응답:

```json
{"status":"ok"}
```

### Terminal 2 — Django

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

### Terminal 3 — React

```powershell
Push-Location frontend-react
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
```

브라우저에서 `http://127.0.0.1:5173`에 접속합니다.

## 6. 정상 QA 순서

1. 회원가입
2. 프로필 작성·저장
3. 수동 공고문 입력 또는 기본 진단
4. 전략 진단 실행
5. 결과 조회
6. 챗봇 질문

전략 진단은 약 30~40초가 걸릴 수 있습니다. Django의 FastAPI timeout은 기본 90초이고 React는 약 95초 후 요청을 취소합니다.

PDF는 FastAPI endpoint가 없어 현재 정상 QA 경로에서 제외합니다.

## 7. 자동 검증

Django:

```powershell
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py check
..\.venv\Scripts\python.exe manage.py test
Pop-Location
```

FastAPI import:

```powershell
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'backend'); from main import app; print(app.title)"
```

React:

```powershell
Push-Location frontend-react
pnpm.cmd run build
Pop-Location
```

## 8. 오류 대응

### 포트 중복 `[Errno 10048]`

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen
Stop-Process -Id <OwningProcess-PID>
```

종료 대상이 프로젝트 서버인지 확인한 뒤 중지합니다. Django는 8000, React는 5173으로 확인합니다.

### `pnpm.ps1` 실행 불가

```powershell
pnpm.cmd run dev
```

필요하면 현재 PowerShell에만 정책을 완화합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### React API 500

브라우저에서 Django 연결은 성공했고 서버 처리 중 실패한 상태입니다. Django 터미널을 확인합니다. 전략·챗봇 요청이면 FastAPI 실행 여부와 `OPENAI_API_KEY`도 확인합니다.

### Django 502

FastAPI 연결 실패, 5xx 또는 timeout입니다.

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

`FASTAPI_API_URL`과 FastAPI 로그를 확인합니다.

### ChromaDB 오류

로컬 ChromaDB가 없거나 collection이 깨졌다면 재생성합니다.

```powershell
.\.venv\Scripts\python.exe backend\src\preprocessing\build_all.py
```

OpenAI embedding 비용이 발생할 수 있으므로 키와 실행 범위를 먼저 확인합니다.

## 9. 운영 주의사항

- 운영에서 `DJANGO_DEBUG=false`를 사용합니다.
- 운영용 `DJANGO_SECRET_KEY`를 별도로 생성합니다.
- CORS, CSRF, allowed hosts에 무분별한 `*`를 사용하지 않습니다.
- `.env`, `.env.local`, API 키, 운영 도메인을 커밋하지 않습니다.
- 현재 CSRF exempt 인증은 운영 배포 전에 교체해야 합니다.
