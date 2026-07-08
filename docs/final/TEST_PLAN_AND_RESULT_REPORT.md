# 테스트 계획 및 결과 보고서

| 항목 | 내용 |
|---|---|
| 프로젝트 | A-FIT 청약 진단 서비스 |
| 문서 목적 | 평가 산출물 기준의 기능, LLM/API, 배포 검증 계획과 현재 검증 결과 정리 |
| 작성일 | 2026-07-08 |
| 기준 브랜치 | `pdf-improvement-0707` |
| 기준 커밋 | `9992295 Improve mypage report UX and deployment checks` |
| 상태 | 최종 제출 후보. EC2 실배포 검증은 확인 필요 |

## 1. 테스트 개요

본 테스트는 React-Django-FastAPI 구조로 확장된 청약 진단 웹서비스가 핵심 사용자 흐름, LLM 연동 예외 처리, 배포 구성 측면에서 평가 기준을 만족하는지 확인하기 위해 수행했다.

평가계획서의 테스트 항목은 다음 네 가지로 해석했다.

| 평가 요소 | 본 문서의 확인 범위 |
|---|---|
| 기능 테스트 커버리지 | 인증, 프로필, 진단, PDF, 결과 상세, 마이페이지, 챗봇 |
| LLM API 연동 테스트 | 정상 응답, 실패 응답, timeout, fallback 설계와 일부 자동 테스트 |
| 배포 환경 검증 | Docker Compose/Nginx 설정 파일 검증, EC2 실배포 절차 확인 필요 |
| 결과 분석 및 개선 이력 | 발견 이슈, 원인, 수정, 재검증 결과 추적 |

## 2. 테스트 환경

| 구분 | 현재 확인 상태 |
|---|---|
| 로컬 OS | Windows |
| Python | 3.10.x 가상환경 |
| Node.js | 22.x 계열, `corepack pnpm` 사용 |
| React | Vite SPA, `frontend-react` |
| Django | Django 5.2.15, session 인증, SQLite |
| FastAPI | `Backend`, LangGraph/RAG/PDF 분석 API |
| LLM | OpenAI API Key 필요. 실제 호출은 환경변수 의존 |
| DB | 로컬/Compose 기준 SQLite, 운영 고도화 시 PostgreSQL/RDS 후속 과제 |
| Docker | `docker-compose.yml`, `docker-compose.prod.yml`, Dockerfile 존재 |
| 배포 URL | `http://a-fit.duckdns.org/` 사용 예정 또는 팀 배포 환경 기준. 본 문서 작성 시점의 외부 URL 접속은 NOT_TESTED |

## 3. 자동 검증 결과

| ID | 구분 | 명령 | 결과 | 상태 | 비고 |
|---|---|---|---|---|---|
| AUTO-FE-01 | Frontend | `corepack pnpm --dir frontend-react lint` | ESLint 통과 | PASS | ESLint 설정 신규 추가 |
| AUTO-FE-02 | Frontend | `corepack pnpm --dir frontend-react typecheck` | TypeScript 오류 없음 | PASS | `tsconfig.json` 기준 |
| AUTO-FE-03 | Frontend | `corepack pnpm --dir frontend-react test` | 8개 Node 계약 테스트 통과 | PASS | 소스 계약 기반 회귀 테스트 |
| AUTO-FE-04 | Frontend | `corepack pnpm --dir frontend-react build` | Vite production build 성공 | PASS | `dist/` 생성 |
| AUTO-BE-01 | Django | `.\.venv\Scripts\python.exe django_backend\manage.py test accounts -v 1` | 13개 테스트 통과 | PASS | 인증, 비밀번호 변경, 계정 삭제 검증 포함 |
| AUTO-DEP-01 | Deployment | `.\.venv\Scripts\python.exe -m pytest tests\test_deployment_configuration.py -q` | 9개 테스트 통과 | PASS | Nginx/Docker/env 설정 정적 검증 |
| AUTO-GIT-01 | Git | `git diff --check` | CRLF 경고만 발생, whitespace 오류 없음 | PASS | Windows line ending 경고는 기능 오류 아님 |

## 4. 브라우저 수동 검증 결과

로컬 개발 서버 기준으로 브라우저 플러그인을 사용해 실제 화면을 확인했다.

| ID | 구분 | 테스트 항목 | 절차 | 기대 결과 | 실제 결과 | 상태 | 비고 |
|---|---|---|---|---|---|---|---|
| MAN-FE-01 | 인증 | 회원가입/자동 로그인 | `/login`에서 테스트 계정 생성 | 가입 후 보호 화면으로 이동 | `/profile`로 이동, 세션 유지 | PASS | 로컬 테스트 계정 사용 |
| MAN-FE-02 | 마이페이지 | 계정 카드 표시 | `/mypage` 접속 | 계정 정보, 가입일, 진단 수, 계정 관리 표시 | 표시됨 | PASS | 문구 `계정 정보` 반영 |
| MAN-FE-03 | 마이페이지 | 기본 정보 진단 위치 | 계정 카드 아래 확인 | 계정 정보 -> 기본 정보 진단 -> 공고 기반 분석 순서 | 순서 확인 | PASS | 모바일/데스크톱 확인 |
| MAN-FE-04 | 챗봇 | Floating 챗봇 열기/닫기 | 우하단 챗봇 버튼 클릭 후 닫기 | 패널 열림/닫힘, 레이아웃 유지 | 정상, 가로 overflow 없음 | PASS | 모바일 390px 확인 |
| MAN-FE-05 | 계정 관리 | 계정 관리 모달 | 마이페이지 계정 관리 클릭 | 비밀번호 변경, 계정 삭제 UI 표시 | 표시 및 닫기 정상 | PASS | 실제 삭제는 자동 테스트로 검증 |
| MAN-FE-06 | 기본 진단 | 기본 진단 실행 | 프로필 저장 후 마이페이지에서 기본 진단 클릭 | 결과 상세 페이지 이동 | `/results/{id}` 이동 | PASS | FastAPI 로컬 서버 응답 확인 |
| MAN-FE-07 | 결과 상세 | Floating 프로필 보기 | 결과 화면에서 `내 프로필` 클릭 | 스냅샷 모달 열림, 저장 프로필 표시 | 인천/무주택/청약통장 값 표시 | PASS | Escape/focus trap 코드 보강 |
| MAN-FE-08 | 결과 상세 | 다시 진단하기 | 결과 화면에서 버튼 클릭 | `/profile` 이동 후 최상단 표시 | `scrollY=0` 확인 | PASS | 모바일 viewport 확인 |
| MAN-FE-09 | 반응형 | 모바일 가로 넘침 | 390x844 viewport에서 마이페이지/결과 확인 | horizontal overflow 없음 | 없음 | PASS | 브라우저 viewport 검증 |
| MAN-FE-10 | 반응형 | 데스크톱 결과 화면 | 1280x720에서 결과 상세 확인 | 공고 정보, 플로팅 UI 표시 | 표시됨, overflow 없음 | PASS | 공고 정보 카드형 패널 확인 |

## 5. 기능 테스트 케이스

| ID | 구분 | 테스트 항목 | 절차 | 기대 결과 | 실제 결과 | 상태 | 비고 |
|---|---|---|---|---|---|---|---|
| TC-AUTH-01 | 인증 | 회원가입 | 이메일/비밀번호 입력 후 가입 | 사용자 생성 및 세션 발급 | 브라우저 수동 검증 PASS | PASS | 비밀번호 규칙 프론트 검증 포함 |
| TC-AUTH-02 | 인증 | 로그인 | 기존 계정으로 로그인 | 세션 발급 후 보호 화면 이동 | 계약 테스트 및 수동 흐름 확인 | PASS | |
| TC-AUTH-03 | 인증 | 로그아웃 | 헤더 로그아웃 클릭 | 세션 제거 후 랜딩/로그인 상태 | 소스 계약/브라우저 헤더 확인 | PARTIAL | 클릭까지 별도 수동 실행은 생략 |
| TC-AUTH-04 | 인증 | 보호 라우트 | 비로그인 상태로 보호 URL 접근 | `/login` 이동 | 프론트 계약 테스트 통과 | PASS | |
| TC-PROFILE-01 | 프로필 | 프로필 조회 | `/profile` 접속 | 저장된 프로필 로드 또는 신규 작성 | 브라우저에서 저장 프로필 로드 확인 | PASS | |
| TC-PROFILE-02 | 프로필 | 금액 입력 단위 | 만원 단위 입력 UI 확인 | 원 단위 저장 안내 | 계약 테스트 통과 | PASS | 실제 저장 회귀는 후속 DOM 테스트 권장 |
| TC-STR-01 | 진단 | 기본 프로필 진단 | 마이페이지 기본 진단 클릭 | 결과 상세 생성 | 브라우저 검증 PASS | PASS | |
| TC-STR-02 | 진단 | 공고문 직접 입력 진단 | `/strategy`에서 텍스트 입력 후 실행 | 공고 기반 결과 생성 | NOT_TESTED | NOT_TESTED | 발표 전 직접 확인 필요 |
| TC-PDF-01 | PDF | PDF 업로드 분석 | PDF 파일 업로드 | summary/diagnosis/extracted_fields 생성 | 기존 작업 중 샘플 PDF 확인, 현재 회귀는 NOT_TESTED | PARTIAL | 추가 샘플 회귀 필요 |
| TC-PDF-02 | PDF | PDF 결과 전략 연결 | 분석 결과 확인 후 진단 실행 | 결과 상세 이동 및 이력 저장 | 소스 계약 테스트 통과 | PARTIAL | 실제 최신 로컬 수동 재검증 필요 |
| TC-RESULT-01 | 결과 | 결과 상세 조회 | `/results/{id}` 접속 | 요약, 공급유형, 상세 정보 표시 | 브라우저 검증 PASS | PASS | |
| TC-MYPAGE-01 | 이력 | 마이페이지 진단 이력 | `/mypage` 접속 | 계정/기본진단/공고기반 분석 표시 | 브라우저 검증 PASS | PASS | |
| TC-CHAT-01 | 챗봇 | 질문/답변 | 챗봇에 질문 입력 | 답변 및 출처 표시 | NOT_TESTED | NOT_TESTED | OpenAI/ChromaDB 상태 필요 |
| TC-CHAT-02 | 챗봇 | 출처 표시 | 답변 하단 출처 토글 확인 | 출처 확인 가능 | 소스 구조 확인 | PARTIAL | 실제 질의 필요 |

## 6. LLM/API 연동 테스트

| ID | 항목 | 기대 결과 | 현재 확인 | 상태 | 비고 |
|---|---|---|---|---|---|
| LLM-01 | 정상 응답 | FastAPI 진단 결과가 Django를 통해 저장/응답 | 기본 진단 성공 | PASS | 공고 없는 진단 기준 |
| LLM-02 | FastAPI 연결 실패 | Django가 사용자용 오류로 변환 | 코드 및 오류 계약 확인 | PARTIAL | 장애 주입 자동화 필요 |
| LLM-03 | Timeout | 504 `FASTAPI_TIMEOUT` 계열로 처리 | 서비스 코드/문서 확인 | PARTIAL | 실제 timeout 주입 미실행 |
| LLM-04 | RAG 검색 실패 | `found=False` 또는 안내 메시지, 전체 서비스 유지 | 코드 설계 기준 | PARTIAL | 실제 ChromaDB 실패 주입 미실행 |
| LLM-05 | PDF LLM 요약 실패 | 규칙 기반 정리본 유지 | PDF 개선 설계/소스 계약 확인 | PARTIAL | 장애 주입 미실행 |
| LLM-06 | 사용자 오류 메시지 | API envelope를 프론트 오류 문구로 변환 | 프론트 계약 테스트 통과 | PASS | `errorPresentation.ts` |

## 7. 배포 환경 검증

| ID | 항목 | 절차 | 기대 결과 | 현재 결과 | 상태 | 비고 |
|---|---|---|---|---|---|---|
| DEP-01 | Dockerfile 존재 | frontend/django/fastapi Dockerfile 확인 | 3개 서비스 이미지 빌드 가능 | 파일 존재 확인 | PASS | 실제 빌드는 NOT_TESTED |
| DEP-02 | Compose 구성 | `docker-compose.yml`, `docker-compose.prod.yml` 확인 | frontend, django, fastapi, volume 정의 | 파일 확인 | PASS | 정적 검증 |
| DEP-03 | Nginx proxy | `/api/` -> `django-backend:8000` | React와 API 경계 분리 | 설정 테스트 통과 | PASS | `client_max_body_size 20m` 포함 |
| DEP-04 | Docker 이미지 build | `docker-compose build` | 이미지 생성 | 실행하지 않음 | NOT_TESTED | 로컬 Docker 이미지 빌드 미수행 |
| DEP-05 | Docker Hub push/pull | `docker compose pull` | EC2에서 최신 이미지 수신 | 실행하지 않음 | NOT_TESTED | 팀 배포 담당 확인 필요 |
| DEP-06 | EC2 compose up | `docker compose up -d` | 컨테이너 정상 기동 | 실행하지 않음 | NOT_TESTED | 발표 전 서버에서 확인 필요 |
| DEP-07 | 외부 URL 접속 | `http://a-fit.duckdns.org/` 접속 | 랜딩/로그인 화면 표시 | 실행하지 않음 | NOT_TESTED | 실제 운영 상태 확인 필요 |
| DEP-08 | DB 데이터 유지 | 컨테이너 재기동 후 사용자/이력 유지 | `django-db` volume으로 SQLite 유지 | 설계 확인 | PARTIAL | 실제 재기동 검증 필요 |

## 8. 발견 이슈 및 수정 이력

| ID | 이슈 | 원인 | 수정 내용 | 재검증 결과 | 상태 |
|---|---|---|---|---|---|
| ISSUE-01 | 마이페이지 탭명이 실제 역할과 불일치 | 기존 `진단 기록` 명칭이 계정/이력 기능을 포괄하지 못함 | 탭명을 `마이페이지`로 변경, 계정 정보 카드 추가 | 브라우저/계약 테스트 PASS | 해결 |
| ISSUE-02 | 계정 관리 기능 부족 | 비밀번호 변경/삭제 UI/API 부재 | 비밀번호 변경 API, 비밀번호 확인 기반 계정 삭제, 확인 모달 추가 | Django accounts 테스트 PASS | 해결 |
| ISSUE-03 | 챗봇이 우측 영역을 계속 차지 | 고정 aside 방식으로 화면 활용성 저하 | Floating 버튼/패널로 변경 | 모바일/데스크톱 브라우저 확인 PASS | 해결 |
| ISSUE-04 | 결과 상세 화면에서 프로필 확인이 하단 버튼에 의존 | 리포트 중간 확인이 불편함 | Floating `내 프로필` 버튼과 모달 추가 | 브라우저 확인 PASS | 해결 |
| ISSUE-05 | PDF/레포트 업로드 크기와 Nginx edge limit 불일치 가능 | Nginx 기본 업로드 제한 | `client_max_body_size 20m` 설정 | 배포 설정 테스트 PASS | 해결 |
| ISSUE-06 | ESLint 검증 불가 | 프론트 프로젝트에 ESLint 설정 없음 | ESLint flat config와 script 추가 | `pnpm lint` PASS | 해결 |

## 9. 남은 개선 과제

| 항목 | 상태 | 후속 조치 |
|---|---|---|
| EC2 실배포 재검증 | NOT_TESTED | Docker Hub pull, compose up, 외부 URL 접속 확인 |
| 공고문 직접 입력 최신 회귀 | NOT_TESTED | 샘플 공고문으로 `/strategy` 수동 테스트 |
| PDF 샘플 다건 회귀 | PARTIAL | `sample_pdfs` 다건으로 결과 품질 비교 |
| 챗봇 실제 RAG 질의 | NOT_TESTED | ChromaDB/OpenAI Key 준비 후 질문/출처 확인 |
| LLM 장애 주입 자동화 | PARTIAL | FastAPI mock 또는 timeout fixture 추가 |
| 운영 보안 | 후속 과제 | HTTPS, secure cookie, CSRF 운영 설정 검증 |

