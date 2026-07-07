# 프로젝트 명세

기준일: 2026-07-03

## 1. 목표

3차 프로젝트의 청약 계산·LangGraph·RAG 기능을 React와 Django 기반 웹 서비스로 통합합니다. 사용자는 회원가입 후 프로필을 저장하고, 수동 모집공고·PDF 추출 공고문·기본 프로필을 바탕으로 전략 진단 결과와 챗봇 답변을 확인할 수 있어야 합니다.

## 2. 현재 MVP 범위

| 기능 | 상태 | 완료 기준 |
|---|---|---|
| 회원가입·로그인·로그아웃 | 완료 | Django session cookie로 인증 유지 |
| 프로필 조회·저장·수정 | 완료 | 사용자별 프로필과 소유권 분리 |
| 기본 프로필 진단 | 완료 | Django가 FastAPI/LangGraph를 호출하고 결과 저장 |
| 수동 공고문 기반 진단 | 완료 | 공고 텍스트를 전략 진단에 반영 |
| 결과 목록·상세 조회 | 완료 | 실행별 snapshot과 result payload 조회 |
| RAG 챗봇 | 완료 | React → Django → FastAPI `/api/chat` |
| PDF 업로드 기반 진단 | 완료 | 원본 저장 없이 텍스트/표 추출 후 전략 진단 입력으로 연결 |
| Docker·CI·배포 재현 | 미완료 | 새 clone 자동 실행 구조 필요 |

MVP 정상 경로는 다음과 같습니다.

```text
회원가입
  → 프로필 저장
  → 기본 진단, 수동 공고문 입력 또는 PDF 추출
  → 전략 진단
  → 결과 조회
  → 챗봇 질문
```

PDF는 공고문 텍스트와 표를 추출해 `announcement_text` 입력으로 연결합니다. 구조화 필드 자동 확정은 후속 고도화 범위입니다.

## 3. 시스템 구조

```text
Browser
  → React/Vite :5173
  → Django REST API :8000
       ├─ session 인증
       ├─ SQLite 사용자·프로필·진단 이력
       └─ HTTP proxy
            → FastAPI :8080
                 → LangGraph
                 → 계산 도구
                 → RAG / ChromaDB
                 → OpenAI
```

| 계층 | 책임 |
|---|---|
| React | 입력 UI, 로딩·오류 상태, 결과 표시, 챗봇 UI |
| Django | 공개 API, session 인증, 사용자 소유권, 저장, FastAPI adapter/proxy |
| FastAPI | 기존 AI 기능을 내부 HTTP API로 제공 |
| LangGraph·계산기 | 청약 자격·가점·재무 계산과 전략 생성 |
| RAG·ChromaDB | 공식 문서 검색, 근거와 출처 제공 |

브라우저는 FastAPI를 직접 호출하지 않습니다. 공개 API 경계는 Django입니다.

## 4. 주요 요청 흐름

### 전략 진단

```text
React POST /api/strategy
  → Django profile 조회·검증
  → 4차 profile을 3차 FastAPI schema로 변환
  → FastAPI POST /api/profile
  → FastAPI POST /api/simulate
  → 공고문이 있으면 POST /api/announcement
  → Django StrategyRun에 snapshot/result 저장
  → React 결과 화면
```

공고문이 있을 때 호출 순서는 `profile → simulate → announcement`입니다.

### 챗봇

```text
React POST /api/chatbot
  → Django 인증·throttle
  → FastAPI POST /api/chat
  → RAG 답변·출처
  → Django 공통 envelope
  → React 답변 카드·출처 토글
```

## 5. 인증과 보안

| 항목 | 현재 기준 |
|---|---|
| 인증 | Django session cookie |
| React 요청 | `credentials: "include"` |
| CORS | 허용 origin을 환경변수로 명시 |
| 사용자 격리 | Profile, StrategyRun, AnnouncementInput 소유권 확인 |
| throttle | 인증 사용자 기준 `60/min` |
| 비밀값 | 루트 `.env`, Git 제외 |

현재 `CsrfExemptSessionAuthentication`이 상태 변경 요청의 CSRF 검사를 생략합니다. 로컬 통합에는 동작하지만 운영 보안 기준에는 부족합니다. 배포 전 표준 CSRF token 발급·전송 구조로 교체해야 합니다.

## 6. 저장 모델

| 모델 | 저장 내용 |
|---|---|
| `User` | Django 사용자와 인증 정보 |
| `Profile` | 청약통장, 거주, 무주택, 세대, 혼인·자녀, 소득·자산 |
| `AnnouncementInput` | 수동 입력 또는 PDF 추출 후 사용자가 확정한 공고 |
| `StrategyRun` | 상태, 입력 snapshot, FastAPI result payload, 실행 시각 |

현재 DB는 `django_backend/db.sqlite3`입니다. PostgreSQL 전환은 배포 단계의 후속 작업입니다.

## 7. 설계 원칙

- 정답이 있는 가점·자격·재무 계산은 Python 코드가 담당합니다.
- LLM은 자유 텍스트 구조화, 설명, 전략 문장 생성에 사용합니다.
- React는 3차 내부 필드명을 알지 않습니다.
- 4차 공개 필드와 3차 AI 필드 변환은 Django `ProfileAdapter` 한 곳에서 수행합니다.
- `null`, `0`, `false`, 필드 누락은 서로 다르게 취급합니다.
- AI 실패 시 실행 상태를 `FAILED`로 저장하고 구조화된 오류를 반환합니다.

## 8. 데이터와 RAG

다음 항목은 기존 AI 핵심 자산으로 유지합니다.

- `Backend/data/`: 원천 문서와 구조화 계산 데이터
- `Backend/src/engine/`: LangGraph node, tool, calculator
- `Backend/src/rag/`: retriever와 chat graph
- `Backend/src/preprocessing/`: 문서 전처리와 ChromaDB 생성
- `Backend/src/preprocessing/chroma_db/`: 로컬 생성 Vector DB

ChromaDB는 Git에 포함하지 않습니다. 새 환경에서는 필요할 때 전처리 스크립트로 재생성합니다.

## 9. 다음 우선순위

1. 응답 adapter를 한 계층으로 정리하고 Result 계약 고정
2. LLM 초기화와 앱 import 분리, timeout·fallback 정리
3. PDF 추출 결과의 구조화 필드 자동 확정 여부 검토
4. 표준 CSRF 적용
5. Docker Compose, 배포 환경변수, CI 구성
6. 새 clone 기준 전원 통합 QA

## 10. 기준 문서 우선순위

충돌이 생기면 다음 순서로 판단합니다.

1. 실행 중인 코드와 자동 테스트
2. [260703_API_CONTRACT.md](260703_API_CONTRACT.md)
3. `fixture_examples/`
4. 본 문서
5. `reports/`의 과거 분석 자료
