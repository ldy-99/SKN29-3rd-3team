# 테스트 계획 및 결과 보고서 (v2)

| 항목 | 내용 |
|---|---|
| 프로젝트 | A-FIT 청약 진단 서비스 |
| 문서 목적 | 기능, LLM/API, 실서버 배포 검증 계획 및 최종 수행 결과 보고 |
| 작성일 | 2026-07-09 |
| 기준 브랜치 | `pdf-improvement-0707` |
| 상태 | 최종 제출 완료본 (로컬 빌드/푸시 및 EC2 실배포 가동 전수 검증 완료) |

## 1. 테스트 개요

본 테스트는 React-Django-FastAPI 구조로 확장된 청약 진단 웹서비스가 핵심 사용자 흐름, LLM 연동 예외 처리, 그리고 운영 배포 구성 측면에서 프로젝트 평가 기준을 만족하는지 검증하기 위해 수행했다.

평가 항목은 다음 네 가지 범주로 분류하여 확인했다.

| 평가 요소 | 본 문서의 확인 범위 |
|---|---|
| 기능 테스트 커버리지 | 회원 인증, 청약 프로필, 전략 진단, PDF 분석, 결과 상세, 마이페이지, Floating AI 어시스턴트 |
| LLM API 연동 테스트 | 정상 연동 응답, 장애 조입 대응, timeout, fallback 설계 및 데이터 격리 |
| 배포 환경 검증 | Docker Compose 설정 검증, Gunicorn 전환, Nginx 프록시 및 포트 80 웹표준 인입 테스트 |
| 결과 분석 및 개선 이력 | 발견된 버그 및 인프라적 병목 현상의 원인 분석, 조치 및 재검증 이력 추적 |

---

## 2. 테스트 환경

| 구분 | 최종 확인 상태 |
|---|---|
| 로컬 OS | Windows |
| Python | 3.10.x 가상환경 |
| Node.js | 22.x 계열, `corepack pnpm` 사용 |
| React | Vite SPA, `frontend-react` |
| Django | Django 5.2.15, Gunicorn WAS 구동, Session 인증, SQLite |
| FastAPI | `Backend` 디렉토리, LangGraph/RAG/PDF 분석 API |
| LLM | OpenAI API Key 연동 환경변수 사용 |
| DB | SQLite (도커 볼륨 영구 보존 연동 완료) |
| Docker | `docker-compose.yml`, `docker-compose.prod.yml`, 각 파트별 Dockerfile 완비 |
| 배포 URL | **`http://a-fit.duckdns.org/` (외부 접속 및 로그인/가입 기능 검증 완료, PASS)** |

---

## 3. 자동 검증 결과

개발 파이프라인에서 제공하는 스크립트를 통해 코드 품질 및 계약 안전성을 자동으로 검증했다.

| ID | 구분 | 명령 | 결과 | 상태 | 비고 |
|---|---|---|---|---|---|
| AUTO-FE-01 | Frontend | `corepack pnpm --dir frontend-react lint` | ESLint 오류 없음 | PASS | 코드 스타일 규격 준수 |
| AUTO-FE-02 | Frontend | `corepack pnpm --dir frontend-react typecheck` | TypeScript 타입 오류 없음 | PASS | 컴파일 안전성 확보 |
| AUTO-FE-03 | Frontend | `corepack pnpm --dir frontend-react test` | 8개 Node 계약 테스트 통과 | PASS | 핵심 로직 회귀 검증 |
| AUTO-FE-04 | Frontend | `corepack pnpm --dir frontend-react build` | Vite production build 성공 | PASS | 정적 빌드 배포본(`dist/`) 생성 |
| AUTO-BE-01 | Django | `.\.venv\Scripts\python.exe django_backend\manage.py test accounts -v 1` | 13개 테스트 통과 | PASS | 회원가입, 로그인, 패스워드 변경, 탈퇴 검증 |
| AUTO-DEP-01 | Deployment | `.\.venv\Scripts\python.exe -m pytest tests\test_deployment_configuration.py -q` | 9개 테스트 통과 | PASS | Nginx 및 Docker 컴포즈 설정 정적 검증 |
| AUTO-GIT-01 | Git | `git diff --check` | CRLF 경고 외 공백(whitespace) 오류 없음 | PASS | 협업 규격 준수 |

---

## 4. 브라우저 수동 검증 결과

실서버 및 로컬 개발 환경에서 실제 브라우저를 띄워 UI/UX 요구사항에 대한 수동 검증을 완료했다.

| ID | 구분 | 테스트 항목 | 절차 | 기대 결과 | 실제 결과 | 상태 |
|---|---|---|---|---|---|---|
| MAN-FE-01 | 인증 | 회원가입/자동 로그인 | 로그인 화면에서 가입 수행 | 가입 완료 후 메인화면 자동 이동 | `/profile`로 이동 및 세션 자동 유지 | PASS |
| MAN-FE-02 | 마이페이지 | 계정 카드 표시 | `/mypage` 접속 | 이메일, 가입일, 진단 수가 카드 형태로 표시 | 정보 표시 확인 | PASS |
| MAN-FE-03 | 마이페이지 | 기본 정보 진단 위치 | 계정 카드 아래 구조 확인 | 계정 카드 ➡️ 기본 진단 ➡️ 공고 분석 순 배치 | 순서 일치 확인 | PASS |
| MAN-FE-04 | AI 어시스턴트 | Floating AI 어시스턴트 제어 | 우하단 AI 어시스턴트 버튼 클릭 및 닫기 | 패널 열림/닫힘, 가로 overflow 없음 | 정상 작동, 모바일 뷰포트 유지 | PASS |
| MAN-FE-05 | 계정 관리 | 계정 관리 모달 | 마이페이지 계정 관리 클릭 | 비밀번호 변경, 계정 탈퇴 UI 표시 | 비밀번호 변경 및 탈퇴 프로세스 확인 | PASS |
| MAN-FE-06 | 기본 진단 | 기본 정보 진단 실행 | 프로필 저장 후 마이페이지에서 진단 실행 | 진단 리포트 생성 및 결과 상세 이동 | `/results/{id}` 정상 진입 | PASS |
| MAN-FE-07 | 결과 상세 | Floating 프로필 보기 | 결과 화면에서 `내 프로필` 클릭 | 진단 당시 스냅샷 정보가 모달로 팝업 | 저장값 대조 일치 확인 | PASS |
| MAN-FE-08 | 결과 상세 | 다시 진단하기 | 결과 화면에서 버튼 클릭 | `/profile`로 이동하며 화면 최상단 위치 | `scrollY=0` 스크롤 확인 | PASS |
| MAN-FE-09 | 반응형 | 모바일 해상도 대응 | 390px 폭 브라우저 검증 | 가로 스크롤 및 요소 찌그러짐 없음 | 레이아웃 정상 반응 | PASS |
| MAN-FE-10 | 반응형 | 데스크톱 해상도 대응 | 1280px 해상도 검증 | 리포트 및 공고 정보 카드 나열 확인 | 레이어 정상 렌더링 | PASS |

---

## 5. 기능 테스트 케이스

| ID | 구분 | 테스트 항목 | 기대 결과 | 실제 결과 | 상태 | 비고 |
|---|---|---|---|---|---|---|
| TC-AUTH-01 | 인증 | 회원가입 | 사용자 DB 등록 및 자동 로그인 | 가입 완료 및 세션 쿠키 발급 확인 | PASS | 비밀번호 형식 검증 적용 |
| TC-AUTH-02 | 인증 | 로그인 | 아이디/비밀번호 확인 후 세션 발급 | 로그인 후 보호 페이지 자동 진입 | PASS | 인증 토큰 처리 성공 |
| TC-AUTH-03 | 인증 | 로그아웃 | 세션 즉시 파기 및 로그인 화면 복귀 | 세션 만료 및 `/login` 리다이렉트 확인 | PASS | |
| TC-AUTH-04 | 인증 | 보호 라우트 | 비로그인 상태로 내부 페이지 접근 차단 | 로그인 페이지로 강제 리다이렉트 | PASS | |
| TC-PROFILE-01 | 프로필 | 프로필 조회/저장 | 청약 조건 입력값 조회 및 업데이트 | 입력 정보 영구 저장 및 리로드 확인 | PASS | |
| TC-PROFILE-02 | 프로필 | 금액 입력 단위 | 만원 단위 입력 및 원 단위 백엔드 전달 | 정상 저장 및 1만 배수 계산 확인 | PASS | |
| TC-STR-01 | 진단 | 기본 프로필 진단 | 저장 프로필 기반 즉시 진단 실행 | 가점 및 적합도 계산 완료 및 저장 | PASS | |
| TC-STR-02 | 진단 | 공고문 직접 입력 진단 | 텍스트 공고 입력 후 진단 실행 | 공고 맞춤형 진단 보고서 생성 | PASS | |
| TC-PDF-01 | PDF | PDF 업로드 분석 | PDF 파일 업로드 및 핵심 텍스트 파싱 | 텍스트 요약 및 정보 구조화 필드 생성 | PASS | Nginx 20MB 업로드 가능 |
| TC-PDF-02 | PDF | PDF 결과 전략 연결 | 분석된 텍스트 기반 청약 진단 실행 | 결과 화면 이동 및 이력 정상 연동 | PASS | |
| TC-RESULT-01 | 결과 | 결과 상세 조회 | `/results/{id}` 결과 데이터 로드 | 요약, 공급유형별 판정결과 표시 확인 | PASS | |
| TC-MYPAGE-01 | 이력 | 마이페이지 이력 관리 | 저장된 모든 이전 진단 이력 나열 | 기본 정보 및 공고 기반 이력 조회 | PASS | |
| TC-CHAT-01 | AI 어시스턴트 | RAG 질문/답변 | 질문에 대한 AI 어시스턴트 답변 수신 | RAG 기반 맞춤형 청약 지식 답변 수신 | PASS | OpenAI API 실연동 확인 |
| TC-CHAT-02 | AI 어시스턴트 | 출처 표시 | 답변 데이터 하단 출처 표기 | 참고한 법령/공고문 정보 정상 노출 | PASS | |

---

## 6. LLM/API 연동 및 예외 처리 테스트

| ID | 항목 | 기대 결과 | 실제 확인 결과 | 상태 |
|---|---|---|---|---|
| LLM-01 | 정상 응답 | 외부 LLM 호출 후 데이터 요약 가공 성공 | AI 청약 진단 및 AI 어시스턴트 답변 성공 | PASS |
| LLM-02 | FastAPI 연결 실패 | Django가 사용자 친화적 에러로 변환 및 전달 | 에러 봉투(Envelope) 기반 예외 메시지 반환 확인 | PASS |
| LLM-03 | Timeout 처리 | 504 Gateway Timeout 또는 90초 초과 시 안내 | Timeout 한계 도달 시 오류 안전 메시지 반환 | PASS |
| LLM-04 | RAG 검색 실패 | ChromaDB 검색 실패 시에도 전체 앱 중단 방지 | 검색 결과가 없음을 안내하고 대화 흐름 유지 | PASS |
| LLM-05 | PDF 요약 실패 | LLM 요약 실패 시 기본 텍스트 정보 유지 | 분석 예외 발생 시 규칙 기반 원본 요약 표시 | PASS |
| LLM-06 | 사용자 에러 메시지 | 4xx, 5xx 에러 발생 시 사용자 친화 문구 변환 | `errorPresentation.ts` 모듈을 통한 UI 에러 연동 | PASS |

---

## 7. 실서버 배포 환경 검증 (EC2 & Docker Compose)

| ID | 항목 | 절차 | 기대 결과 | 실제 확인 결과 | 상태 |
|---|---|---|---|---|---|
| DEP-01 | Dockerfile 빌드 | `docker-compose build` 실행 | 3개 서비스(React, Django, FastAPI) 이미지 생성 | 빌드 및 태그 생성 완료 | PASS |
| DEP-02 | Compose 구성 검증 | prod 컴포즈 파일 로드 | 프론트, 백엔드, named 볼륨 간 의존성 확인 | 볼륨 및 의존성 설계 일치 | PASS |
| DEP-03 | Nginx reverse proxy | Nginx 포트 80 바인딩 | 외부에서 포트 번호 없이 접속 및 프록시 분배 | `/`, `/api/`, `/admin/` 일괄 서빙 성공 | PASS |
| DEP-04 | 이미지 푸시/풀 | 도커 허브 `push` 후 EC2 `pull` | 원격 빌드 이미지의 실서버 무손실 전송 | 다운로드 레이어 병합 완료 | PASS |
| DEP-05 | EC2 구동 및 서버 전환 | `docker compose up -d` | Gunicorn 및 Whitenoise 기반 백엔드 구동 | 3개 컨테이너 전원 정상 기동 | PASS |
| DEP-06 | 외부 도메인 접속 | `a-fit.duckdns.org` 접속 | 메인페이지 및 회원가입/로그인 완료 | 실서버 로그인 및 세션 가동 성공 | PASS |
| DEP-07 | DB 데이터 영구 보존 | 컨테이너 강제 재구동 후 검증 | 볼륨 마운트를 통해 사용자 계정 및 이력 유지 | `docker compose down` 후 재기동 시 데이터 보존 확인 | PASS |

---

## 8. 발견 이슈 및 조치 사항 (개선 이력)

| ID | 이슈 내용 | 원인 분석 | 해결 및 조치 내용 | 재검증 결과 |
|---|---|---|---|---|
| **ISSUE-01** | 실서버 배포 시 컨테이너 재구동 마다 회원 데이터 유실 | SQLite 데이터베이스 파일(`db.sqlite3`)이 임시 컨테이너 영역인 `/app/db.sqlite3`에 생성되어 컨테이너가 갱신될 때마다 삭제됨 | Django `settings.py`를 수정하여 환경변수로 DB 경로를 조절 가능하게 한 후, `docker-compose.prod.yml` 환경변수에 볼륨 영역인 `/app/data/db.sqlite3`를 주입함 | 컨테이너를 삭제하고 재생성해도 회원 정보와 진단 이력이 영구 보존됨 (**해결**) |
| **ISSUE-02** | 어드민 로그인 이후 웹 앱 회원가입/로그인 시 403 Forbidden 에러 발생 | 어드민 로그인으로 인해 브라우저에 `csrftoken` 쿠키가 생긴 상태에서 React가 POST 전송 시 `X-CSRFToken` 헤더를 누락하여 Django 보안 검증에서 차단됨 | React API 통신 클라이언트(`client.ts`)에 브라우저 쿠키에서 `csrftoken`을 추출하는 헬퍼 함수를 추가하고, POST/PUT 등의 요청 헤더에 자동으로 병합하여 전송하도록 보완함 | 회원가입 및 로그인이 중단 없이 성공함 (**해결**) |
| **ISSUE-03** | 배포 모드(`DJANGO_DEBUG=False`) 구동 시 로그인 세션 유지 실패 | 보안 설정인 `SESSION_COOKIE_SECURE=True`로 인해 브라우저가 일반 HTTP 주소 접속 시 쿠키 저장을 거부함 | `settings.py`에서 환경변수로 쿠키 보안 강제를 비활성화할 수 있도록 변경하고, HTTP 통신인 EC2 `.env` 설정에 `false`를 적용함 | 로그인 세션이 풀리지 않고 페이지 이동 간 성공 유지됨 (**해결**) |
| **ISSUE-04** | 배포 환경에서 장고 관리자 페이지 디자인(CSS/JS) 깨짐 현상 | 디버그 모드가 꺼지면 장고 개발 서버가 정적 파일 서빙을 중단함 | Django `Dockerfile` 실행 명령어를 `gunicorn` 및 `Whitenoise` 미들웨어를 활용한 정식 운영 모드로 전면 전환하고, `--insecure`를 대체하여 실배포 정적 서빙 안정성을 확보함 | 관리자 페이지의 오리지널 디자인이 깨지지 않고 정상 표시됨 (**해결**) |

---

## 9. 후속 개선 과제

* **HTTPS 보안 프로토콜 적용:** DuckDNS 도메인에 Let's Encrypt 무료 SSL 인증서를 탑재하여 완벽한 HTTPS 통신 환경 구축 및 쿠키 보안 옵션(`Secure=True`) 활성화.
* **프로덕션 데이터베이스 전환:** 현재 단일 파일 방식의 SQLite 데이터베이스 구조에서 동시성 제어 및 가용성이 높은 PostgreSQL 또는 AWS RDS로의 마이그레이션.
* **CI/CD 운영 검증 고도화:** GitHub Actions 기반 도커 빌드, 허브 푸시, EC2 원격 재기동 흐름은 구현 완료했다. 후속으로 배포 직후 smoke test와 실패 알림을 자동화한다.
