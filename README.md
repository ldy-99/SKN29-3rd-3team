# 청약 진단 서비스

React, Django, FastAPI/LangGraph를 연결한 청약 프로필 기반 전략 진단 서비스입니다.

## 현재 구성

```text
React (:5173)
  └─ Django REST API (:8000)
       ├─ 세션 인증, 프로필, 진단 이력 저장
       └─ FastAPI AI API (:8080)
            └─ LangGraph, 계산 도구, RAG, ChromaDB, OpenAI
```

기존 3차 Streamlit 화면은 제거했습니다. 웹 화면은 `frontend-react/`만 사용합니다.
3차 프로젝트의 FastAPI, LangGraph, 계산 로직, RAG 데이터와 ChromaDB는 AI 핵심 자산으로 유지합니다.

## 검증된 사용자 흐름

1. 회원가입 및 Django 세션 로그인
2. 사용자 프로필 저장
3. 수동 모집공고 입력 또는 기본 프로필 기반 전략 진단
4. Django에서 FastAPI/LangGraph 호출
5. 진단 결과 저장 및 조회
6. RAG 챗봇 질문

PDF 업로드 화면과 Django 프록시는 존재하지만 FastAPI의 `/api/pdf/analyze`가 아직 구현되지 않아 MVP의 정상 경로는 수동 공고문 입력입니다.

`version-1-integrate-0706` 브랜치의 통합 흐름은 [통합 인수인계 문서](docs/current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md)를 먼저 확인합니다.

## 빠른 실행

권장 환경은 Python 3.10과 Node.js 20 이상입니다.

### 1. 환경 파일

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`의 `OPENAI_API_KEY`를 설정합니다. 현재 브랜치의 실행 흐름은 이 README와 [문서 색인](docs/README.md)을 기준으로 확인합니다.

### 2. Python 의존성

```powershell
py -3.10 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m pip install -r django_backend\requirements.txt
Push-Location django_backend
python manage.py migrate
Pop-Location
```

정상적으로 가상환경에 들어가면 PowerShell 프롬프트 앞에 `(.venv)`가 표시됩니다. 표시되지 않으면 `where python`으로 `.venv\Scripts\python.exe`가 먼저 잡히는지 확인합니다.

로컬 개발 편의용으로만 한 번에 설치하려면 아래 파일을 사용할 수 있습니다. 배포나 컨테이너 구성에서는 서비스별 requirements를 직접 사용합니다.

```powershell
python -m pip install -r requirements-dev.txt
```

### 3. ChromaDB 구축

RAG 챗봇과 전략 진단 검색을 확인하려면 서버 실행 전에 ChromaDB를 한 번 만들어야 합니다. 이 단계는 OpenAI embedding API를 사용하므로 루트 `.env`의 `OPENAI_API_KEY`가 먼저 필요합니다.

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
```

정상 기준은 `law_chunks`, `faq_chunks`, `manual_chunks`, `lh_guide_chunks`, `web_faq_chunks`, `guide_chunks` 총 6개 collection입니다.

### 4. React 의존성

```powershell
cd frontend-react
pnpm.cmd install --frozen-lockfile
cd ..
```

`pnpm` PowerShell 스크립트 실행이 차단되면 `pnpm` 대신 `pnpm.cmd`를 사용합니다.

### 5. 서버 실행

각 명령을 루트 디렉터리의 별도 PowerShell에서 실행합니다.

```powershell
# Terminal 1: FastAPI
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --reload --host 127.0.0.1 --port 8080
```

```powershell
# Terminal 2: Django
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

```powershell
# Terminal 3: React
cd frontend-react
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
```

브라우저에서 `http://127.0.0.1:5173`에 접속합니다. 통합 브랜치의 세부 확인 순서는 [통합 인수인계 문서](docs/current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md)를 따릅니다.

## 검증 명령

개발 환경을 빠르게 점검하려면 아래 스크립트를 사용할 수 있습니다. 이 스크립트는 로컬 개발 편의용이며 운영 health check가 아닙니다.

```powershell
.\scripts\dev-doctor.ps1
```

```powershell
# Django
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py test
Pop-Location

# FastAPI import
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'Backend'); from main import app; print(app.title)"

# React
cd frontend-react
pnpm.cmd run build
```

## 주요 디렉터리

```text
Backend/                 FastAPI, LangGraph, 계산기, RAG 및 원천 데이터
django_backend/          인증, 프로필, 진단 이력, FastAPI 프록시
frontend-react/          React/Vite 사용자 화면
fixture_examples/        API 계약 예시
docs/                    프로젝트·API·실행·협업 기준 문서
docs/reports/            기존 AI/RAG 분석 보고서
```

## 환경 및 의존성 파일

| 파일 | 용도 |
|---|---|
| `.env.example` | FastAPI와 Django 공용 환경변수 예시 |
| `frontend-react/.env.example` | Vite 환경변수 예시 |
| `requirements-dev.txt` | 로컬 개발 편의용 통합 설치 파일 |
| `requirements.txt` | FastAPI/RAG 의존성 |
| `django_backend/requirements.txt` | Django API 의존성 |
| `frontend-react/pnpm-lock.yaml` | React 의존성 잠금 파일 |

실제 `.env`와 `.env.local`은 Git에 커밋하지 않습니다.

## 상세 문서

- [문서 색인](docs/README.md)
- [프로젝트 명세](docs/current/PROJECT_SPEC.md)
- [API 계약](docs/current/API_CONTRACT.md)
- [통합 인수인계 문서](docs/current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md)
- [팀 작업 가이드](docs/guides/TEAM_GUIDE.md)
- [변경 이력](docs/traces/CHANGELOG.md)
