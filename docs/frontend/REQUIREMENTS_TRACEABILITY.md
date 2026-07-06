# 프론트엔드 요구사항 추적표

작성일: 2026-07-06

## 1. 기능 요구사항

| ID | 요구사항 | 사용자 시나리오 | 화면·URL | 연결 API | 구현 파일 | 테스트 ID | 상태 |
|---|---|---|---|---|---|---|---|
| FR-01 | 사용자는 이메일과 비밀번호로 로그인할 수 있어야 한다. | 로그인 후 보호 화면 이용 | `/login` | `POST /api/auth/login` | `pages/Login.tsx`, `auth/AuthContext.tsx` | TC-01 | 완료 |
| FR-02 | 사용자는 계정을 생성하고 비밀번호 규칙을 확인할 수 있어야 한다. | 회원가입 후 자동 로그인 | `/login` | `POST /api/auth/signup` | `pages/Login.tsx` | TC-01 | 완료 |
| FR-03 | 로그인 세션은 페이지 이동 중 유지되어야 한다. | 랜딩 복귀 후에도 로그인 상태 유지 | 공통 | `GET /api/auth/me` | `auth/AuthContext.tsx`, `components/SiteHeader.tsx` | TC-02 | 완료 |
| FR-04 | 비로그인 사용자는 보호 화면에 접근할 수 없어야 한다. | 보호 URL 접근 시 로그인 이동 | 보호 라우트 전체 | `GET /api/auth/me` | `components/Layout.tsx` | TC-02 | 완료 |
| FR-05 | 사용자는 청약 프로필을 조회·저장할 수 있어야 한다. | 필수 조건과 선택 조건 저장 | `/profile` | `GET/PUT /api/user/profile` | `pages/Profile.tsx` | TC-03 | 완료 |
| FR-06 | 관련 없는 추가 입력은 숨기고 부모 조건 해제 시 값을 제거해야 한다. | 기혼·자녀·무주택 조건별 추가 입력 | `/profile` | `PUT /api/user/profile` | `pages/Profile.tsx` | TC-03 | 완료 |
| FR-07 | 사용자는 프로필만으로 기본 진단을 실행할 수 있어야 한다. | 공고 없이 기본 조건 진단 | `/strategy` | `POST /api/strategy` | `pages/StrategyRun.tsx` | TC-07 | 완료 |
| FR-08 | 사용자는 공고문 텍스트로 상세 진단을 실행할 수 있어야 한다. | 공고문 붙여넣기 후 전략 실행 | `/strategy` | `POST /api/strategy` | `pages/StrategyRun.tsx` | TC-07 | 완료 |
| FR-09 | 사용자는 저장된 진단 기록과 상세 결과를 다시 볼 수 있어야 한다. | 마이페이지에서 기록 선택 | `/mypage`, `/results/:id` | `GET /api/strategy/me`, `GET /api/strategy/{id}` | `pages/MyPage.tsx`, `pages/ResultDetail.tsx` | 수동-01 | 완료 |
| FR-10 | 사용자는 PDF 모집공고를 분석해 전략 입력으로 전달할 수 있어야 한다. | PDF 선택 → 추출 확인 → 전략 이동 | `/pdf` | `POST /api/pdf/analyze` | `pages/PdfAnalysis.tsx` | TC-07 | 완료 |
| FR-11 | 사용자는 청약 챗봇에 질문하고 출처를 확인할 수 있어야 한다. | 질문 → 답변 → 출처 펼치기 | `/chatbot`, 우측 패널 | `POST /api/chatbot` | `components/ChatbotPanel.tsx` | TC-05 | 완료 |
| FR-12 | 챗봇 대화 맥락은 브라우저 탭 세션 동안 유지되어야 한다. | 화면 이동 후 후속 질문 | 챗봇 공통 | `POST /api/chatbot` | `components/ChatbotPanel.tsx` | TC-05 | 완료 |
| FR-13 | API 오류는 사용자가 이해할 수 있는 메시지로 표시되어야 한다. | 중복 이메일·필드 오류·서버 오류 확인 | 전체 | Django 오류 envelope | `api/errorPresentation.ts`, `components/UI.tsx` | TC-04 | 완료 |

## 2. 비기능 요구사항

| ID | 요구사항 | 구현·증빙 | 테스트 ID | 상태 |
|---|---|---|---|---|
| NFR-01 | 모바일·태블릿·데스크톱 반응형 UI | Tailwind breakpoint, 모바일 탭, 챗봇 전용 화면 | TC-06, 수동-02 | 완료 |
| NFR-02 | 비동기 요청 중 중복 실행 방지 | `isRunning`, `isUploading`, 버튼 비활성화 | TC-07 | 완료 |
| NFR-03 | 장시간 전략 요청은 무한 대기하지 않아야 한다. | `AbortController`, 95초 타임아웃 | TC-07 | 완료 |
| NFR-04 | 사용자별 인증 요청에 session cookie를 포함해야 한다. | `credentials: "include"` | TC-02 | 완료 |
| NFR-05 | API 비밀값·내부 응답 메타데이터를 화면에 노출하지 않아야 한다. | API 배지·원본 payload 제거, 사용자 오류 매핑 | TC-04 | 완료 |
| NFR-06 | 모션 감소 설정을 존중해야 한다. | `prefers-reduced-motion` | 수동-03 | 완료 |
| NFR-07 | 프론트 프로덕션 빌드가 성공해야 한다. | `pnpm.cmd run build` | BUILD-01 | 완료 |
| NFR-08 | 핵심 프론트 계약을 자동 검증해야 한다. | Node 내장 테스트 7개 | TC-01~07 | 부분 완료 |
| NFR-09 | 운영 환경에서 CSRF 보호를 적용해야 한다. | 현재 프로젝트 문서상 미완료 | 보안 테스트 필요 | 미완료 |

## 3. 테스트 ID

| 테스트 ID | 자동화 범위 |
|---|---|
| TC-01 | 로그인·회원가입 API 연결, 비밀번호 확인 |
| TC-02 | 인증 조회, session cookie, 보호 라우팅 |
| TC-03 | 프로필 조건부 입력과 숨김 값 초기화 |
| TC-04 | API 오류 필드 매핑과 상세 안내 |
| TC-05 | 챗봇 메시지·`session_id` 세션 유지 |
| TC-06 | 모바일 내비게이션과 챗봇 경로 |
| TC-07 | 전략·PDF 장시간 작업 로딩, 중복 방지, 타임아웃 |

## 4. 추적성 판정

- 모든 주요 화면은 기능 요구사항과 연결되어 있다.
- 주요 API 호출은 화면 및 구현 파일과 연결되어 있다.
- 자동 테스트는 현재 소스 계약 검증 수준이며 실제 DOM 클릭·입력·네트워크 모킹 테스트는 후속 보완이 필요하다.
- 운영 CSRF와 배포 환경 검증은 프론트 단독 범위를 넘어 Django·배포 구성과 함께 완료해야 한다.
