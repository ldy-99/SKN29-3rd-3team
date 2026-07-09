# A-FIT 청약 진단 서비스

<div align="center">

### 아파트 분양과 청약이 처음인 사용자를 위한 개인 맞춤형 청약 가능성 진단 서비스

복잡한 청약 제도, 사용자 조건, 모집공고 PDF, 가점과 자금 부담을 한 번에 이해하기 어렵다는 문제를 해결하기 위해
**React 웹서비스**, **Django 인증/저장 API**, **FastAPI LangGraph/RAG AI 엔진**, **Docker/AWS 배포 구조**를 결합했습니다.

<br/>

<img src="https://img.shields.io/badge/Target-청약%20초보자-1D4ED8?style=for-the-badge" />
<img src="https://img.shields.io/badge/Service-아파트%20분양%20진단-0F766E?style=for-the-badge" />
<img src="https://img.shields.io/badge/Core-React%20Django%20FastAPI-334155?style=for-the-badge" />
<img src="https://img.shields.io/badge/AI-LangGraph%20RAG%20PDF-B45309?style=for-the-badge" />
<img src="https://img.shields.io/badge/Deploy-Docker%20AWS%20EC2-475569?style=for-the-badge" />

</div>

---

## 목차

| 구분 | 내용 |
|---|---|
| 1 | [팀 구성 및 역할](#1-팀-구성-및-역할) |
| 2 | [프로젝트 개요](#2-프로젝트-개요) |
| 3 | [핵심 기능](#3-핵심-기능) |
| 4 | [전체 시스템 구조](#4-전체-시스템-구조) |
| 5 | [PDF 분석 및 LLM/RAG 흐름](#5-pdf-분석-및-llmrag-흐름) |
| 6 | [배포 및 CI/CD](#6-배포-및-cicd) |
| 7 | [기술 스택](#7-기술-스택) |
| 8 | [실행 방법](#8-실행-방법) |
| 9 | [검증 방법](#9-검증-방법) |
| 10 | [폴더 구조](#10-폴더-구조) |
| 11 | [주요 화면](#11-주요-화면) |
| 12 | [최종 산출물](#12-최종-산출물) |
| 13 | [프로젝트 회고](#13-프로젝트-회고) |

---

## 1. 팀 구성 및 역할

### 1.1 팀원별 담당 영역

<!-- 팀원 사진은 기존 3차 프로젝트 README 형식을 유지합니다. 이미지 교체가 필요하면 docs/assets/team 경로에 최신 사진을 넣어주세요. -->

<table width="100%">
  <tr>
    <td align="center" width="25%">
      <img src="./docs/assets/team/jun-eok.jpg" width="220" /><br/>
      <h3>준억</h3>
      <b>Backend · Integration</b><br/>
      <sub>Django/FastAPI 연동, PDF 개선, 산출물 정리</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/team/dong-yoon.jpg" width="220" /><br/>
      <h3>동윤</h3>
      <b>Deployment · Backend</b><br/>
      <sub>Docker/AWS 배포, Nginx/Gunicorn 운영 설정</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/team/ji-hoon.jpg" width="220" /><br/>
      <h3>지훈</h3>
      <b>AI Backend · Planning</b><br/>
      <sub>LangGraph, RAG, 청약 진단 파이프라인</sub>
    </td>
    <td align="center" width="25%">
      <img src="./docs/assets/team/eun-jin.jpg" width="220" /><br/>
      <h3>은진</h3>
      <b>Frontend · Planning</b><br/>
      <sub>React 화면, 사용자 흐름, UI 개선</sub>
    </td>
  </tr>
</table>

| 팀원 | 역할 | 담당 영역 |
|---|---|---|
| 준억 | Backend / Integration | Django-FastAPI 연동, PDF 공고문 요약/진단 연결, 마이페이지/결과 UX 보강, 최종 산출물 정리 |
| 동윤 | Deployment / Backend | Docker 이미지 빌드/푸시, AWS EC2 배포, Nginx 80포트 단일화, Gunicorn/관리자 프록시 설정 |
| 지훈 | AI Backend / Planning | LangGraph 진단 파이프라인, RAG 챗봇, 청약 계산/전략 흐름 설계 |
| 은진 | Frontend / Planning | React/Vite 화면 구현, API 연동 UI, 프로필/진단/결과 화면 사용자 흐름 정리 |

---

## 2. 프로젝트 개요

> 청약 초보자는 내가 어떤 공급 유형에 유리한지, 공고문 조건을 충족하는지, 결과를 나중에 다시 볼 수 있는지 판단하기 어렵습니다.

A-FIT은 사용자의 청약 조건과 아파트 분양 모집공고를 기반으로 청약 가능성을 참고용으로 진단하고, 결과를 리포트와 마이페이지 이력으로 저장하는 웹서비스입니다.

| 서비스 관점 | 설계 내용 |
|---|---|
| 사용자 | 아파트 분양 청약을 준비하는 초보 사용자 |
| 문제 | 청약 제도, 공고문 PDF, 가점, 자금 조건을 스스로 해석하기 어렵다 |
| 해결 | 프로필 기반 기본 진단, PDF 공고문 요약, LangGraph/RAG 기반 설명과 전략 리포트 제공 |
| 결과 | 청약 가능성, 추천 방향, 공고 요약, 진단 이력을 한 화면에서 확인 |

```mermaid
flowchart LR
    A["회원가입/로그인"] --> B["청약 프로필 입력"]
    B --> C["기본 조건 진단"]
    B --> D["PDF/공고문 기반 진단"]
    D --> E["LLM 요약 및 구조화"]
    C --> F["AFIT Report"]
    E --> F
    F --> G["마이페이지 이력"]
    G --> H["RAG 챗봇 질의"]
```

---

## 3. 핵심 기능

| 기능 | 사용자에게 보이는 가치 | 구현 방식 |
|---|---|---|
| 회원가입/로그인 | 개인별 프로필과 진단 이력 관리 | Django session 인증 |
| 청약 프로필 입력 | 거주, 세대, 무주택, 통장, 소득 조건 저장 | Django Profile API + React form |
| 기본 조건 진단 | 공고 없이 현재 내 조건 기준 빠른 진단 | FastAPI LangGraph 진단 |
| PDF 모집공고 분석 | 복잡한 공고문을 짧게 요약하고 진단 입력으로 변환 | PDF text/table extraction + LLM summary |
| 공고 기반 결과 리포트 | 공고 조건을 반영한 청약 가능성 분석 | Django StrategyRun 저장 + 결과 상세 |
| 마이페이지 | 공고별 분석 이력과 기본 진단 결과 재조회 | 카드형 이력 UI |
| RAG 챗봇 | 청약 제도 질문에 근거 기반 답변 | ChromaDB + OpenAI |
| PDF 저장 | 결과 화면을 PDF로 저장 | 브라우저 print/export 기반 |
| 계정 관리 | 비밀번호 변경, 계정 삭제 | Django accounts API |

---

## 4. 전체 시스템 구조

```mermaid
flowchart LR
    User["사용자 브라우저"] --> Nginx["Nginx / React SPA"]
    Nginx -->|"/api/*"| Django["Django REST API"]
    Nginx -->|"/admin/*"| Admin["Django Admin"]
    Django --> DB[("SQLite / django-db volume")]
    Django -->|"FASTAPI_API_URL"| FastAPI["FastAPI AI Service"]
    FastAPI --> LangGraph["LangGraph 진단 파이프라인"]
    FastAPI --> Chroma[("ChromaDB")]
    FastAPI --> OpenAI["OpenAI API"]
```

| 계층 | 책임 |
|---|---|
| React/Vite | 사용자 화면, 폼 입력, 로딩/오류 처리, 마이페이지/결과 상세 |
| Nginx | 정적 파일 제공, `/api/`, `/admin/`, `/static/admin/` 프록시, PDF 업로드 edge limit |
| Django | 인증, 세션, 프로필, 진단 이력 저장, FastAPI proxy |
| FastAPI | PDF 분석, LangGraph 진단, RAG 챗봇, LLM 호출 |
| SQLite | 사용자/프로필/진단 이력 저장, Docker volume으로 보존 |
| ChromaDB | 청약 제도 문서 기반 RAG 검색 |
| OpenAI | 공고문 구조화/요약, RAG 답변 합성, 리포트 문장 생성 |

---

## 5. PDF 분석 및 LLM/RAG 흐름

PDF 원본은 저장하지 않고, 추출/요약 결과만 사용자 확인 및 진단 입력에 사용합니다.

```mermaid
sequenceDiagram
    actor U as 사용자
    participant R as React
    participant D as Django
    participant F as FastAPI
    participant L as LLM

    U->>R: PDF 드래그/선택
    R->>D: POST /api/pdf/analyze
    D->>F: 내부 PDF 분석 요청
    F->>F: 텍스트/표 추출
    F->>L: 공고 요약/구조화 요청
    L-->>F: summary_text / diagnosis_text / extracted_fields
    F-->>D: 분석 결과 반환
    D-->>R: 사용자 확인용 요약 표시
    U->>R: 진단 실행
```

| 산출 데이터 | 용도 |
|---|---|
| `summary_text` | 마이페이지와 사용자 확인용 짧은 공고 요약 |
| `diagnosis_text` | 전략 진단에 전달되는 구조화된 공고문 정보 |
| `extracted_fields` | 공고명, 위치, 공급유형, 공급세대, 금액, 일정 등 |

---

## 6. 배포 및 CI/CD

최종 배포는 Docker Hub 이미지와 AWS EC2 기반으로 구성했습니다.

| 항목 | 내용 |
|---|---|
| 운영 URL | `http://a-fit.duckdns.org/` |
| EC2 | `43.201.113.124` |
| 이미지 저장소 | Docker Hub `dongyoon99/*` |
| 운영 포트 | HTTP `80:80` |
| Django 실행 | `migrate -> collectstatic -> gunicorn` |
| DB 보존 | `django-db` Docker volume |
| CI/CD | GitHub Actions 기반 검증, 이미지 빌드/푸시, EC2 배포 |

```mermaid
flowchart LR
    Code["final merge / push"] --> Test["lint/typecheck/test/build"]
    Test --> Build["Docker image build"]
    Build --> Hub["Docker Hub push"]
    Hub --> EC2["EC2 docker compose pull"]
    EC2 --> Up["docker compose up -d"]
    Up --> URL["a-fit.duckdns.org"]
```

자세한 배포 산출물은 [docs/final/DEPLOYMENT_CICD_FINAL.md](docs/final/DEPLOYMENT_CICD_FINAL.md)를 참고합니다.

---

## 7. 기술 스택

| 영역 | 기술 | 역할 |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, pnpm | 사용자 화면, SPA 라우팅, 상태 관리 |
| API Backend | Django 5, DRF, django-cors-headers | 인증, 세션, 프로필, 진단 이력 |
| AI Backend | FastAPI, LangGraph, LangChain | 청약 진단 파이프라인, RAG, PDF 분석 |
| LLM/RAG | OpenAI, ChromaDB | 공고 요약, 질의응답, 근거 검색 |
| PDF | PyMuPDF, pdfplumber, pypdf | PDF 텍스트/표 추출 |
| Deployment | Docker, Nginx, Gunicorn, AWS EC2, Docker Hub | 컨테이너 배포 및 운영 |
| Quality | ESLint, TypeScript, pytest, node:test | 정적 검증 및 회귀 테스트 |

---

## 8. 실행 방법

### 8.1 환경 파일

```powershell
Copy-Item .env.example .env
Copy-Item frontend-react\.env.example frontend-react\.env.local
```

루트 `.env`에는 최소한 `OPENAI_API_KEY`, `DJANGO_SECRET_KEY`, `FASTAPI_API_URL`을 설정합니다. 로컬 Vite 개발에서는 `frontend-react/.env.local`의 `VITE_API_BASE_URL`을 비워두면 Vite proxy가 Django `127.0.0.1:8000`으로 요청을 넘깁니다.

### 8.2 Python 의존성

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r django_backend\requirements.txt
```

### 8.3 React 의존성

```powershell
cd frontend-react
corepack pnpm install --frozen-lockfile
cd ..
```

### 8.4 DB migration

```powershell
.\.venv\Scripts\python.exe django_backend\manage.py migrate
```

### 8.5 로컬 서버 실행

터미널 3개를 사용합니다.

```powershell
# Terminal 1. FastAPI
.\.venv\Scripts\python.exe -m uvicorn main:app --app-dir Backend --reload --host 127.0.0.1 --port 8080
```

```powershell
# Terminal 2. Django
.\.venv\Scripts\python.exe django_backend\manage.py runserver 127.0.0.1:8000
```

```powershell
# Terminal 3. React
cd frontend-react
corepack pnpm dev -- --host 127.0.0.1 --port 5173
```

브라우저 접속:

```text
http://127.0.0.1:5173
```

### 8.6 Docker 운영 배포

```bash
docker-compose build
docker-compose push
```

EC2:

```bash
cd ~/app
docker compose pull
docker compose up -d
docker ps
docker compose logs --tail=100
```

### 8.7 흐름별 오류 대처법

| 흐름 | 증상 | 확인/해결 |
|---|---|---|
| Python 가상환경 | `ModuleNotFoundError`, Python 3.13로 실행됨 | `.\.venv\Scripts\python.exe --version`으로 3.10.x 확인 후 `pip install -r requirements.txt -r django_backend\requirements.txt` 재실행 |
| 패키지 설치 | `pip install` 실패 | `.\.venv\Scripts\python.exe -m pip install --upgrade pip` 후 재시도. Python 3.10 환경인지 먼저 확인 |
| Django DB | `no such table: accounts_user` | `.\.venv\Scripts\python.exe django_backend\manage.py migrate` 실행 |
| 회원가입/API | `username`, `nickname` 필수 오류가 나옴 | 8000번에 FastAPI 등 다른 서버가 떠 있는 상태일 수 있음. `Invoke-WebRequest http://127.0.0.1:8000/admin/`로 Django admin 화면 확인 |
| React API 연결 | 로그인/회원가입 요청이 엉뚱한 서버로 감 | `frontend-react/.env.local`의 `VITE_API_BASE_URL=`을 비워두고 Vite proxy 사용 |
| pnpm | `pnpm` 또는 `pnpm.cmd`를 찾지 못함 | Node 20 이상에서 `corepack pnpm --version` 확인 후 `corepack pnpm install --frozen-lockfile` 사용 |
| ChromaDB/RAG | collection이 비어 있거나 HNSW 오류 발생 | `.\.venv\Scripts\python.exe -X utf8 Backend\src\preprocessing\build_all.py`로 ChromaDB 재구축 |
| PDF 업로드 | 큰 PDF 업로드 실패 | 프론트/백엔드는 15MB 정책, Nginx edge limit은 20MB. 운영 설정의 `client_max_body_size 20m` 확인 |
| Docker 배포 | 최신 코드가 EC2에 반영되지 않음 | 로컬/CI에서 이미지 build 후 Docker Hub push, EC2에서 `docker compose pull && docker compose up -d` 재실행 |
| 운영 접속 | `a-fit.duckdns.org`는 뜨지만 `/admin/`이 안 열림 | Nginx에 `/admin/`, `/static/admin/` 프록시가 포함되어 있는지 확인 |
| HTTP 쿠키 | 운영 HTTP에서 로그인 세션이 유지되지 않음 | HTTP 운영 기준 `DJANGO_SESSION_COOKIE_SECURE=false`, `DJANGO_CSRF_COOKIE_SECURE=false` 확인. HTTPS 전환 시 true로 변경 |

---

## 9. 검증 방법

```powershell
# Django
.\.venv\Scripts\python.exe django_backend\manage.py check
.\.venv\Scripts\python.exe django_backend\manage.py test accounts strategy

# 배포 설정
.\.venv\Scripts\python.exe -m pytest tests\test_deployment_configuration.py -q

# Frontend
cd frontend-react
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm run build
cd ..
```

| 검증 항목 | 상태 |
|---|---|
| ESLint | PASS |
| TypeScript | PASS |
| Frontend test/build | PASS |
| Django accounts/strategy test | PASS |
| Docker/Nginx/env 정적 검증 | PASS |
| Docker Hub/AWS EC2 배포 | PASS |
| HTTP 80 외부 접속 | PASS |
| PDF 다건 품질 회귀 | 추가 개선 과제 |
| 챗봇 실제 RAG 질의 회귀 | 추가 개선 과제 |

---

## 10. 폴더 구조

```text
version-1_check/
├── Backend/                  # FastAPI AI/RAG/LangGraph/PDF 서비스
├── django_backend/           # Django 인증, 프로필, 진단 이력, FastAPI proxy
├── frontend-react/           # React/Vite 사용자 화면
├── deploy/nginx/             # 운영 Nginx proxy 설정
├── docs/
│   ├── current/              # 현재 기준 공유 문서
│   ├── final/                # 최종 평가 산출물
│   ├── guides/               # 협업 가이드
│   ├── reports/              # 기존 AI/RAG 분석 보고서
│   └── traces/               # 변경 이력 추적
├── tests/                    # 배포 설정 등 pytest
├── docker-compose.yml        # 로컬 빌드 기반 compose
├── docker-compose.prod.yml   # Docker Hub pull 기반 운영 compose
├── requirements.txt          # FastAPI/RAG Python 의존성
└── README.md
```

---

## 11. 주요 화면

현재 화면 캡처는 최종 배포 화면 기준으로 다시 삽입해야 합니다. 아래 칸은 제출 전 캡처 삽입 위치입니다.

| 화면 | 설명 | 캡처 |
|---|---|---|
| 랜딩/로그인 | 서비스 진입, 회원가입/로그인 | 삽입 필요 |
| 프로필 입력 | 청약통장, 거주지, 무주택, 소득 등 입력 | 삽입 필요 |
| 전략 진단 | 기본 진단, 공고문 직접 입력, PDF 분석 진입 | 삽입 필요 |
| PDF 분석 | 모집공고 PDF 업로드, 요약 결과 확인 | 삽입 필요 |
| 결과 상세 | AFIT Report, 공고 기본 정보, 프로필 확인, PDF 저장 | 삽입 필요 |
| 마이페이지 | 계정 정보, 기본 진단, 공고별 분석 이력 | 삽입 필요 |
| 챗봇 | Floating RAG 챗봇, 답변/출처 표시 | 삽입 필요 |
| Django Admin | 포트 80 기반 `/admin/` 관리자 페이지 | 삽입 필요 |

---

## 12. 최종 산출물

| 산출물 | 파일 |
|---|---|
| 최종 산출물 색인 | [docs/final/README.md](docs/final/README.md) |
| 요구사항 정의서 | [docs/final/REQUIREMENTS_SPECIFICATION_FINAL.md](docs/final/REQUIREMENTS_SPECIFICATION_FINAL.md) |
| 화면설계서 | [docs/final/SCREEN_DESIGN_FINAL.md](docs/final/SCREEN_DESIGN_FINAL.md) |
| 시스템 구성도 | [docs/final/SYSTEM_ARCHITECTURE_FINAL.md](docs/final/SYSTEM_ARCHITECTURE_FINAL.md) |
| 테스트 계획 및 결과 보고서 | [docs/final/TEST_PLAN_AND_RESULT_REPORT.md](docs/final/TEST_PLAN_AND_RESULT_REPORT.md) |
| Docker/AWS/CI-CD 배포 정리 | [docs/final/DEPLOYMENT_CICD_FINAL.md](docs/final/DEPLOYMENT_CICD_FINAL.md) |
| 발표자료 가이드 | [docs/final/PRESENTATION_GUIDE_10MIN.md](docs/final/PRESENTATION_GUIDE_10MIN.md) |
| 최종 체크리스트 | [docs/final/FINAL_DELIVERABLE_CHECKLIST.md](docs/final/FINAL_DELIVERABLE_CHECKLIST.md) |

---

## 13. 프로젝트 회고

### 준억

> Django와 FastAPI를 연결하고 PDF 공고문 분석, 마이페이지, 결과 리포트 흐름을 개선하면서 AI 엔진을 실제 서비스 UX로 감싸는 과정의 중요성을 배웠습니다. 특히 LLM 요약 결과를 그대로 보여주는 것이 아니라 사용자가 이해하고 다시 확인할 수 있는 정보 구조로 정리하는 일이 서비스 완성도에 큰 영향을 준다는 점을 체감했습니다.

### 동윤

> Docker 이미지 빌드와 AWS EC2 배포, Nginx/Gunicorn 운영 설정을 정리하며 로컬 개발 결과를 실제 외부 접속 가능한 서비스로 만드는 과정을 담당했습니다. 포트 80 단일화, 관리자 페이지 프록시, 세션/CSRF 쿠키 문제를 해결하면서 배포 환경과 애플리케이션 설정의 정합성이 중요하다는 점을 확인했습니다.

### 지훈

> LangGraph 기반 청약 진단 흐름과 RAG 구조를 통해 청약 도메인의 복잡한 판단을 단계별로 나누어 설계했습니다. 계산 가능한 영역은 규칙 기반으로 고정하고, 설명과 요약은 LLM/RAG로 보완하는 방향이 서비스 신뢰도를 높이는 데 중요하다고 느꼈습니다.

### 은진

> React 화면과 사용자 흐름을 구현하며 청약 초보자가 진단, 결과 확인, 이력 조회를 자연스럽게 이어갈 수 있도록 UI를 정리했습니다. API 응답 구조와 화면 표현이 잘 맞아야 사용자가 복잡한 청약 정보를 부담 없이 이해할 수 있다는 점을 배웠습니다.
