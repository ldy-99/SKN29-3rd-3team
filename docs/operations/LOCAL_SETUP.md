# 통합 로컬 실행 가이드

## 1. 실행 기준

| 항목 | 기준 |
|---|---|
| 운영체제 | Windows 10/11 PowerShell 기준 |
| Python | 3.10.x 권장 |
| Node.js | 20 이상 |
| 패키지 관리자 | Python `pip`, React `pnpm` |
| FastAPI | `127.0.0.1:8080` |
| Django | `127.0.0.1:8000` |
| React | `127.0.0.1:5173` |

Python 3.13은 ChromaDB와 일부 AI 패키지의 호환 문제가 발생할 수 있으므로 팀 공통 환경으로 사용하지 않습니다.

## 2. 새 clone 준비

저장소 루트에서 실행합니다.

```powershell
git clone <repository-url>
cd SKN29-3rd-3team
git switch final
```

### 2.1 Python 가상환경

```powershell
py -3.10 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python --version
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r django_backend\requirements.txt
```

`python --version`은 `3.10.x`여야 합니다. `py -3.10`이 없다면 Python 3.10 또는 Python 3.10 기반 Conda 환경을 먼저 준비합니다.

### 2.2 React 의존성

```powershell
cd frontend-react
pnpm.cmd install --frozen-lockfile
cd ..
```

`pnpm.ps1` 실행 정책 오류가 발생하면 `pnpm.cmd`를 사용합니다. `pnpm`이 없다면 Node.js 설치 후 Corepack을 활성화하거나 pnpm을 설치해야 합니다.

## 3. 환경변수 준비

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

`.env`에서 다음 값을 실제 키로 변경합니다.

```dotenv
OPENAI_API_KEY=your-openai-api-key
```

개발 기본 URL을 그대로 사용한다면 다른 값은 변경하지 않아도 됩니다. 변수별 상세 설명은 [환경변수 명세](ENVIRONMENT_VARIABLES.md)를 확인합니다.

## 4. Django DB 준비

저장소에 `django_backend/db.sqlite3`가 유지되더라도 팀원별 스키마 차이를 방지하기 위해 항상 migration을 실행합니다.

```powershell
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py migrate
Pop-Location
```

## 5. 서버 실행

세 개의 PowerShell을 사용합니다. 모든 명령은 별도 안내가 없으면 저장소 루트에서 실행합니다.

### Terminal 1 — FastAPI/RAG

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

### Terminal 2 — Django API

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

FastAPI를 먼저 실행해야 전략 진단과 챗봇 프록시가 정상 동작합니다.

### Terminal 3 — React

```powershell
cd frontend-react
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
```

브라우저 접속 주소는 `http://127.0.0.1:5173`입니다.

## 6. 통합 수동 QA

다음 순서로 확인합니다.

1. 회원가입
2. 로그인 세션 유지
3. 프로필 입력 및 저장
4. 수동 모집공고문 입력
5. 전략 진단 실행
6. 결과 상세 조회
7. 챗봇 질문 및 출처 토글

전략 진단은 LLM 응답에 따라 약 30~40초가 걸릴 수 있습니다. Django-FastAPI 제한은 기본 90초이고 React는 약 95초 후 요청을 취소합니다.

PDF 업로드는 현재 통합 완료 경로가 아닙니다. React 화면과 Django 프록시는 있지만 FastAPI `/api/pdf/analyze` endpoint가 없으므로 수동 공고문 입력을 사용합니다.

## 7. 자동 검증

### Django

```powershell
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py test
Pop-Location
```

### FastAPI import

```powershell
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'backend'); from main import app; print(app.title)"
```

### React build

```powershell
cd frontend-react
pnpm.cmd run build
```

## 8. 자주 발생하는 오류

### `[Errno 10048]` 포트 중복

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen
Stop-Process -Id <OwningProcess-PID>
```

Django는 `8000`, React는 `5173`으로 같은 방식으로 확인합니다. 종료 대상 PID가 해당 프로젝트 서버인지 먼저 확인합니다.

### `pnpm.ps1` 실행 불가

```powershell
pnpm.cmd run dev
```

또는 현재 PowerShell에만 정책을 완화합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### React에서 API 500

React 연결 자체는 성공했고 Django 내부 처리에서 실패한 상태입니다. Django 터미널 로그를 먼저 확인하고, 전략·챗봇 요청이면 FastAPI 실행 여부와 `OPENAI_API_KEY`를 확인합니다.

### Django에서 502

Django가 FastAPI에 연결하지 못했거나 90초 안에 응답받지 못한 상태입니다. `http://127.0.0.1:8080/health`와 `FASTAPI_API_URL`을 확인합니다.

### ChromaDB collection 오류

현재 로컬 ChromaDB를 유지합니다. DB를 다시 생성해야 할 때만 다음 명령을 실행합니다.

```powershell
.\.venv\Scripts\python.exe backend\src\preprocessing\build_all.py
```

이 작업은 OpenAI embedding 호출을 사용하므로 API 키와 비용을 확인한 뒤 실행합니다.
