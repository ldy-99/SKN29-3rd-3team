# final-debug-share 실행 가이드

이 문서는 `final-debug-share` 브랜치를 새로 받은 팀원이 로컬에서 같은 순서로 실행해 보기 위한 안내입니다.

목표:

- Python/Django/FastAPI/React 의존성을 재현 가능하게 설치한다.
- ChromaDB를 직접 재구축하고 6개 collection 생성을 확인한다.
- React 화면에서 회원가입, 프로필, 전략 진단, 결과, 챗봇까지 확인한다.

주의:

- `.env`, `.env.local`, `.venv`, `node_modules`, `dist`, `Backend/src/preprocessing/chroma_db`, `django_backend/db.sqlite3`는 개인 로컬 산출물입니다.
- 위 파일과 폴더는 공유하거나 커밋하지 않습니다.
- `requirements-dev.txt`와 `scripts/dev-doctor.ps1`은 로컬 개발 편의용입니다. 운영 배포 기준이나 health check가 아닙니다.

## 1. 브랜치 받기

```powershell
git fetch origin
git switch final-debug-share
```

처음 clone하는 경우:

```powershell
git clone <repository-url>
cd <repository-folder>
git switch final-debug-share
```

## 2. Python 버전 확인

권장 버전은 Python 3.10.x입니다.

```powershell
py -3.10 --version
```

`py` 명령이 없다면 설치된 Python을 확인합니다.

```powershell
where python
python --version
```

Python 3.13은 ChromaDB와 일부 AI 패키지에서 팀원별 호환 문제가 날 수 있으므로 공통 환경으로 권장하지 않습니다.

## 3. Python 가상환경 생성

프로젝트 루트에서 실행합니다.

```powershell
py -3.10 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Python 서비스 의존성을 각각 설치합니다.

```powershell
python -m pip install -r requirements.txt
python -m pip install -r django_backend\requirements.txt
```

로컬 개발 편의용으로 한 번에 설치하려면 아래 명령을 사용할 수 있습니다.

```powershell
python -m pip install -r requirements-dev.txt
```

설치 확인:

```powershell
.\.venv\Scripts\python.exe -c "import chromadb, openai, langchain_chroma, django, fastapi; print('deps ok')"
```

## 4. 환경 파일 만들기

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`에서 최소한 `OPENAI_API_KEY`를 설정합니다.

```dotenv
OPENAI_API_KEY=your-openai-api-key
DJANGO_SECRET_KEY=your-local-django-secret-key
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
FASTAPI_API_URL=http://127.0.0.1:8080
FASTAPI_REQUEST_TIMEOUT_SECONDS=90
```

`DJANGO_SECRET_KEY` 생성 예:

```powershell
.\.venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

환경변수 로드 확인:

```powershell
.\.venv\Scripts\python.exe -c "import os; from dotenv import load_dotenv; load_dotenv(); print(bool(os.getenv('OPENAI_API_KEY')))"
```

`True`가 나와야 합니다.

## 5. Django DB 준비

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py migrate
```

확인:

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py check
```

## 6. ChromaDB 재구축

ChromaDB 구축은 OpenAI embedding API를 호출합니다. API 키, 네트워크, 사용량 제한을 먼저 확인합니다.

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
```

정상 완료 시 마지막에 6개 collection이 보여야 합니다.

```text
law_chunks: 163개
faq_chunks: 480개
manual_chunks: 144개
lh_guide_chunks: 18개
web_faq_chunks: 120개
guide_chunks: 76개
```

별도 확인 명령:

```powershell
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

정상 예:

```text
[('faq_chunks', 480), ('guide_chunks', 76), ('law_chunks', 163), ('lh_guide_chunks', 18), ('manual_chunks', 144), ('web_faq_chunks', 120)]
```

## 7. React 의존성 설치

```powershell
Push-Location frontend-react
pnpm.cmd install --frozen-lockfile
Pop-Location
```

`pnpm.cmd`가 없다면 Node.js 20 이상과 pnpm 설치 상태를 확인합니다.

```powershell
node --version
pnpm.cmd --version
```

## 8. 서버 실행

PowerShell 창 3개를 열어 각각 실행합니다.

### Terminal 1 - FastAPI

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --reload --host 127.0.0.1 --port 8080
```

확인:

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

정상:

```json
{"status":"ok"}
```

### Terminal 2 - Django

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

### Terminal 3 - React

```powershell
Push-Location frontend-react
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
```

브라우저에서 접속합니다.

```text
http://127.0.0.1:5173
```

cmd를 쓰는 경우:

```cmd
cd /d <repository-folder>\frontend-react
pnpm.cmd dev -- --host 127.0.0.1 --port 5173
```

## 9. 화면 QA 순서

1. 회원가입
2. 프로필 작성 및 저장
3. 전략 진단 화면 이동
4. `공고 없이 기본 자격만 확인하기` 체크 후 실행
5. 결과 상세 화면 확인
6. 챗봇에 `신혼부부 특별공급 소득 기준은?` 질문

현재 PDF 분석은 정상 QA 경로에서 제외합니다. React 화면과 Django proxy는 있으나 FastAPI `/api/pdf/analyze` endpoint가 아직 없습니다.

## 10. 빠른 점검 스크립트

아래 스크립트는 로컬 개발 편의용입니다.

```powershell
.\scripts\dev-doctor.ps1
```

운영 health check나 배포 gate가 아닙니다.

## 11. 자주 막히는 지점

### `ModuleNotFoundError`

가상환경을 활성화했는지 확인합니다.

```powershell
.\.venv\Scripts\python.exe -c "import chromadb, django, fastapi; print('deps ok')"
```

### `OPENAI_API_KEY`가 없거나 embedding 실패

```powershell
.\.venv\Scripts\python.exe -c "import os; from dotenv import load_dotenv; load_dotenv(); print(bool(os.getenv('OPENAI_API_KEY')))"
```

`False`면 루트 `.env` 위치와 값을 확인합니다.

### ChromaDB collection이 6개가 아님

`build_all.py`는 일부 collection이 실패해도 다음 작업으로 넘어갈 수 있습니다. 반드시 count 확인 명령을 실행합니다.

### `backend` 경로 오류

실제 폴더명은 `Backend`입니다. 명령에서도 대문자 `B`를 사용합니다.

### Windows 콘솔 인코딩 문제

ChromaDB 구축은 아래처럼 UTF-8 모드로 실행합니다.

```powershell
.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py
```

## 12. 문제 공유 시 필요한 출력

에러가 나면 아래 출력과 함께 공유합니다.

```powershell
where python
.\.venv\Scripts\python.exe --version
.\.venv\Scripts\python.exe -c "import chromadb, openai, langchain_chroma; print('deps ok')"
.\.venv\Scripts\python.exe -c "import os; from dotenv import load_dotenv; load_dotenv(); print(bool(os.getenv('OPENAI_API_KEY')))"
.\.venv\Scripts\python.exe -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```
