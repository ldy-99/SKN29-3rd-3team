# 청약 진단 서비스

React, Django, FastAPI/LangGraph를 연결한 청약 프로필 기반 전략 진단 서비스입니다.

현재 실행 구조는 아래와 같습니다.

```text
Browser
  -> React/Vite (:5173)
      -> Django REST API (:8000)
          - session login
          - user profile
          - strategy history
          - FastAPI proxy
              -> FastAPI AI service (:8080)
                  - PDF text extraction
                  - LangGraph pipeline
                  - calculator tools
                  - RAG, ChromaDB, OpenAI
```

`Backend/`는 현재도 사용하는 FastAPI AI/RAG 서비스입니다. 과거 Streamlit 화면과 함께 쓰였던 AI 자산이지만, 현재 웹 화면은 `frontend-react/`만 사용합니다. Streamlit UI는 현재 실행 흐름에 없습니다.

## 먼저 확인할 문서

| 목적 | 문서 |
|---|---|
| 현재 통합 브랜치 구조와 팀원 전달 메모 | [docs/current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md](docs/current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md) |
| 문서 전체 색인 | [docs/README.md](docs/README.md) |
| API 요청/응답 계약 | [docs/current/API_CONTRACT.md](docs/current/API_CONTRACT.md) |
| FastAPI 응답 필드 기준 | [docs/current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md](docs/current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md) |

## 검증 환경

이 브랜치에서 확인한 기준입니다.

| 항목 | 기준 |
|---|---|
| OS | Windows |
| Python | 3.10.x |
| Node.js | 22.23.1 검증, 최소 20 이상 권장 |
| pnpm | `corepack pnpm` 11.9.0 검증 |
| Django | 5.2.15 |
| FastAPI | 0.136.3 |

문제 발생 시 바로 아래의 실행 순서를 따라간 뒤, 하단 [오류 대처법](#오류-대처법)을 확인하세요.

## 1. 브랜치 받기

```powershell
git fetch origin
git switch version-1-integrate-0706
git pull origin version-1-integrate-0706
```

오류 가능성: 현재 작업 중인 변경사항이 있으면 switch/pull이 막힐 수 있습니다. 이 경우 [T8](#t8-git-switchpull이-막힐-때)를 확인하세요.

## 2. 환경 파일 만들기

루트에서 실행합니다.

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`에서 최소한 아래 값을 채웁니다.

```dotenv
OPENAI_API_KEY=sk-...
DJANGO_SECRET_KEY=local-dev-secret
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
FASTAPI_API_URL=http://127.0.0.1:8080
```

`frontend-react/.env.local`은 로컬 Vite 개발 서버 기준으로 비워둡니다.

```dotenv
VITE_API_BASE_URL=
```

이 값을 비워두면 `frontend-react/vite.config.ts`의 `/api` proxy가 Django `127.0.0.1:8000`으로 요청을 넘깁니다.

오류 가능성: `VITE_API_BASE_URL`에 다른 프로젝트 주소가 들어 있으면 회원가입/로그인이 엉뚱한 서버로 갈 수 있습니다. [T3](#t3-회원가입에서-usernamenickname-필수-오류가-나올-때)을 확인하세요.

## 3. Python 가상환경 만들기

권장 방식은 Python 3.10으로 `.venv`를 만드는 것입니다.

```powershell
py -3.10 -m venv .venv
```

`py` 명령이 없고 팀 공용 `torch_env` conda 환경이 있다면 아래처럼 만들 수 있습니다.

```powershell
conda run -n torch_env python -m venv .venv
```

둘 다 어렵다면 Python 3.10 conda 환경을 새로 만든 뒤 venv를 만듭니다.

```powershell
conda create -n skn4_py310 python=3.10 -y
conda run -n skn4_py310 python -m venv .venv
```

가상환경 Python 확인:

```powershell
.\.venv\Scripts\python.exe --version
```

오류 가능성: `python --version`만 보면 다른 Python이 잡힐 수 있습니다. 항상 `.\.venv\Scripts\python.exe`를 직접 호출하세요. [T1](#t1-python-버전이나-venv가-꼬일-때)을 확인하세요.

## 4. Python 의존성 설치

루트에서 실행합니다.

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r django_backend\requirements.txt
```

설치 확인:

```powershell
.\.venv\Scripts\python.exe -c "import django, fastapi, chromadb, openai, langchain_chroma; print('python deps ok')"
```

오류 가능성: 패키지 설치 중 네트워크나 Python 버전 문제로 실패할 수 있습니다. [T2](#t2-pip-install이-실패할-때)를 확인하세요.

## 5. Django DB 준비

루트에서 실행합니다.

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py migrate
```

확인:

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py check
.\.venv\Scripts\python.exe django_backend\manage.py test accounts strategy
```

정상 기준:

```text
System check identified no issues
Ran 26 tests
OK
```

오류 가능성: `no such table: accounts_user`가 나오면 migrate가 안 된 것입니다. [T4](#t4-no-such-table-accounts_user가-나올-때)를 확인하세요.

## 6. ChromaDB 구축

RAG 챗봇과 공고문 기반 전략 분석을 확인하려면 ChromaDB를 먼저 만들어야 합니다. 이 단계는 OpenAI embedding API를 호출하므로 API 사용량이 발생할 수 있습니다.

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
```

구축 확인:

```powershell
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

정상 기준:

```text
[('faq_chunks', 480), ('guide_chunks', 76), ('law_chunks', 163), ('lh_guide_chunks', 18), ('manual_chunks', 144), ('web_faq_chunks', 120)]
```

오류 가능성: `[]`가 나오거나 HNSW reader 오류가 나오면 ChromaDB가 비어 있거나 깨진 것입니다. [T5](#t5-chromadb가-비어-있거나-hnsw-오류가-날-때)를 확인하세요.

## 7. React 의존성 설치

Node.js 20 이상을 사용합니다. Node 22 LTS 이상이면 좋습니다.

```powershell
node --version
corepack --version
corepack pnpm --version
```

설치:

```powershell
cd frontend-react
corepack pnpm install --frozen-lockfile
cd ..
```

오류 가능성: `pnpm.cmd`가 없어도 `corepack pnpm`이 되면 정상입니다. [T6](#t6-pnpmpnpmcmd가-없다고-나올-때)을 확인하세요.

## 8. 서버 3개 실행

터미널 3개를 열고 모두 프로젝트 루트에서 시작합니다.

### Terminal 1. FastAPI

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --reload --host 127.0.0.1 --port 8080
```

확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

### Terminal 2. Django

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

확인:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/admin/
```

Django 관리자 로그인 화면 HTML이 오면 정상입니다.

### Terminal 3. React

```powershell
cd frontend-react
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

브라우저:

```text
http://127.0.0.1:5173
```

오류 가능성: `8000` 포트에 다른 FastAPI 서버가 떠 있으면 회원가입 응답 형식이 완전히 달라집니다. [T3](#t3-회원가입에서-usernamenickname-필수-오류가-나올-때)을 확인하세요.

## 9. 전체 검증 명령

서버 실행 전 정적 검증:

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py check
.\.venv\Scripts\python.exe django_backend\manage.py test accounts strategy
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'Backend'); from main import app; print('fastapi import ok:', app.title)"
```

프론트 검증:

```powershell
cd frontend-react
corepack pnpm test
corepack pnpm run build
cd ..
```

ChromaDB 검증:

```powershell
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

로컬 개발 점검 스크립트:

```powershell
.\scripts\dev-doctor.ps1
```

`dev-doctor.ps1`은 운영 health check가 아니라 로컬 편의용 점검 스크립트입니다.

## 10. 브라우저에서 확인할 흐름

1. `http://127.0.0.1:5173` 접속
2. 회원가입
3. 프로필 입력
4. PDF 분석 또는 수동 공고문 입력
5. 전략 진단 실행
6. 마이페이지에서 진단 이력 확인
7. 챗봇 질문 확인

회원가입은 현재 `email`, `password`만 필요합니다. `username`은 선택이고 `nickname` 필드는 없습니다.

## 내가 로컬에서 실험할 때 쓰는 명령 모음

### 가상환경

```powershell
conda run -n torch_env python -m venv .venv
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r django_backend\requirements.txt
```

### Django

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py migrate
.\.venv\Scripts\python.exe django_backend\manage.py check
.\.venv\Scripts\python.exe django_backend\manage.py test accounts strategy
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

### FastAPI

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --reload --host 127.0.0.1 --port 8080
Invoke-RestMethod http://127.0.0.1:8080/health
```

### ChromaDB

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

### React

```powershell
cd frontend-react
corepack pnpm install --frozen-lockfile
corepack pnpm dev -- --host 127.0.0.1 --port 5173
corepack pnpm test
corepack pnpm run build
cd ..
```

### API 직접 확인

```powershell
Invoke-WebRequest http://127.0.0.1:8000/admin/
```

```powershell
$email = "local$(Get-Random)@example.com"
$body = @{ email = $email; password = "StrongPass123!" } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/auth/signup -Method Post -Body $body -ContentType "application/json" -SessionVariable s
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/auth/me -Method Get -WebSession $s
```

### 포트 확인

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :8080
netstat -ano | findstr :5173
```

### Git

```powershell
git status
git fetch origin
git switch version-1-integrate-0706
git pull origin version-1-integrate-0706
git add -A
git commit -m "message"
git push origin version-1-integrate-0706
```

## 주요 디렉터리

| 경로 | 역할 |
|---|---|
| `Backend/` | 현재 FastAPI AI/RAG/LangGraph 서비스 |
| `django_backend/` | Django 인증, 프로필, 진단 이력, FastAPI proxy |
| `frontend-react/` | React/Vite 화면 |
| `fixture_examples/` | API 계약 예시 |
| `docs/current/` | 현재 기준 문서 |
| `docs/guides/` | 협업 가이드 |
| `docs/traces/` | 변경 이력과 문제 해결 기록 |
| `docs/reports/` | 기존 AI/RAG 분석 보고서 |

## Git에 올리면 안 되는 로컬 파일

아래 파일과 폴더는 로컬 실행 산출물이므로 커밋하지 않습니다.

```text
.env
frontend-react/.env.local
.venv/
django_backend/db.sqlite3
Backend/src/preprocessing/chroma_db/
Backend/src/checkpoints/
frontend-react/node_modules/
frontend-react/dist/
__pycache__/
```

## 오류 대처법

### T1. Python 버전이나 venv가 꼬일 때

증상:

```text
ModuleNotFoundError
Python 3.13.x로 실행됨
django가 설치되어 있는데 못 찾음
```

확인:

```powershell
where python
.\.venv\Scripts\python.exe --version
```

해결:

```powershell
conda run -n torch_env python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r django_backend\requirements.txt
```

항상 `python` 대신 `.\.venv\Scripts\python.exe`를 직접 호출하면 헷갈림이 줄어듭니다.

### T2. pip install이 실패할 때

확인:

```powershell
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -m pip --version
```

해결:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r django_backend\requirements.txt
```

Python 3.10이 아니면 일부 패키지 wheel이 맞지 않을 수 있습니다.

### T3. 회원가입에서 username/nickname 필수 오류가 나올 때

증상:

```json
{"detail":[{"type":"missing","loc":["body","username"]},{"loc":["body","nickname"]}]}
```

판단:

이 응답은 이 프로젝트의 Django 응답이 아닙니다. FastAPI/Pydantic 기본 422 형식입니다. 현재 Django 회원가입은 `email`, `password`만 필수이고 `nickname` 필드는 없습니다.

확인:

```powershell
netstat -ano | findstr :8000
Invoke-WebRequest http://127.0.0.1:8000/admin/
```

정상이면 `/admin/`에서 Django 관리자 로그인 화면이 떠야 합니다. FastAPI Swagger나 다른 응답이 뜨면 8000번 포트를 다른 서버가 잡고 있는 것입니다.

해결:

1. 8000번을 쓰는 다른 프로세스를 종료합니다.
2. Django를 다시 실행합니다.

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

3. `frontend-react/.env.local`의 `VITE_API_BASE_URL`을 비워둡니다.

```dotenv
VITE_API_BASE_URL=
```

### T4. no such table: accounts_user가 나올 때

원인:

Django DB migration을 아직 실행하지 않은 상태입니다.

해결:

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py migrate
```

그 뒤 다시 회원가입을 시도합니다.

### T5. ChromaDB가 비어 있거나 HNSW 오류가 날 때

증상:

```text
[]
Error creating hnsw segment reader: Nothing found on disk
```

해결:

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

6개 collection과 count가 보여야 합니다.

### T6. pnpm/pnpm.cmd가 없다고 나올 때

Node 20 이상에서는 Corepack을 사용할 수 있습니다.

```powershell
node --version
corepack --version
corepack pnpm --version
```

이후 `pnpm.cmd` 대신 아래처럼 실행합니다.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

### T7. React에서 Django API에 연결할 수 없을 때

확인:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/admin/
Get-Content frontend-react\.env.local
```

로컬 Vite dev에서는 `VITE_API_BASE_URL=`가 비어 있어야 `/api` proxy가 동작합니다.

### T8. git switch/pull이 막힐 때

현재 변경사항 확인:

```powershell
git status
```

작업을 임시 보관:

```powershell
git stash push -m "local work before branch update"
git pull origin version-1-integrate-0706
git stash pop
```

충돌이 나면 파일을 열어 충돌 표시를 해결한 뒤 commit합니다.

### T9. 포트가 이미 사용 중일 때

확인:

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :8080
netstat -ano | findstr :5173
```

PID를 확인한 뒤 작업 관리자에서 종료하거나, 다른 포트로 실행합니다.

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8001
```

Django 포트를 바꾸면 `frontend-react/vite.config.ts` proxy도 같이 바꿔야 하므로, 가능하면 기본 포트를 비우는 방식을 권장합니다.
