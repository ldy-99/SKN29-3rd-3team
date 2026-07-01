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

## 빠른 실행

권장 환경은 Python 3.10과 Node.js 20 이상입니다.

### 1. 환경 파일

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`의 `OPENAI_API_KEY`를 설정합니다. 전체 변수 설명은 [환경변수 명세](docs/operations/ENVIRONMENT_VARIABLES.md)를 확인합니다.

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

### 3. React 의존성

```powershell
cd frontend-react
pnpm.cmd install --frozen-lockfile
cd ..
```

`pnpm` PowerShell 스크립트 실행이 차단되면 `pnpm` 대신 `pnpm.cmd`를 사용합니다.

### 4. 서버 실행

각 명령을 루트 디렉터리의 별도 PowerShell에서 실행합니다.

```powershell
# Terminal 1: FastAPI
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir backend --reload --host 127.0.0.1 --port 8080
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

브라우저에서 `http://127.0.0.1:5173`에 접속합니다. 더 자세한 설치·오류 대응은 [통합 실행 가이드](docs/operations/LOCAL_SETUP.md)를 따릅니다.

## 검증 명령

```powershell
# Django
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py test
Pop-Location

# FastAPI import
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'backend'); from main import app; print(app.title)"

# React
cd frontend-react
pnpm.cmd run build
```

## 주요 디렉터리

```text
backend/                 FastAPI, LangGraph, 계산기, RAG 및 원천 데이터
django_backend/          인증, 프로필, 진단 이력, FastAPI 프록시
frontend-react/          React/Vite 사용자 화면
fixture_examples/        API 계약 예시
docs/4th_docs/           4차 범위·API·아키텍처 명세
docs/operations/         실행·환경변수·정리 산출물
docs/reports/            기존 AI/RAG 분석 보고서
```

## 환경 및 의존성 파일

| 파일 | 용도 |
|---|---|
| `.env.example` | FastAPI와 Django 공용 환경변수 예시 |
| `frontend-react/.env.example` | Vite 환경변수 예시 |
| `requirements.txt` | FastAPI/RAG 의존성 |
| `django_backend/requirements.txt` | Django API 의존성 |
| `frontend-react/pnpm-lock.yaml` | React 의존성 잠금 파일 |

실제 `.env`와 `.env.local`은 Git에 커밋하지 않습니다.

## 상세 문서

- [통합 실행 가이드](docs/operations/LOCAL_SETUP.md)
- [환경변수 명세](docs/operations/ENVIRONMENT_VARIABLES.md)
- [3차 파일 정리 내역](docs/operations/CLEANUP_4TH_INTEGRATION.md)
- [4차 프로젝트 범위와 MVP 명세](docs/4th_docs/00_프로젝트_범위와_MVP_명세.md)
- [API 데이터 계약](docs/4th_docs/01_API_데이터_계약_명세.md)
- [시스템 아키텍처 명세](docs/4th_docs/02_시스템_아키텍처_인증_AI연동_명세.md)
