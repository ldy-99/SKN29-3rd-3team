# 프론트엔드 수정·개선 기록표

기준 기간: 2026-07-05 야간 ~ 2026-07-06
담당 범위: React 프론트엔드

## 1. 변경 요약

| 구분 | 변경 전 문제 | 반영 내용 | 사용자 효과 | 주요 파일 |
|---|---|---|---|---|
| 데이터 연결 | fixture·더미 응답과 실제 API 흐름 혼재 | Django API 전용 client와 오류 envelope 적용, mock fixture 제거 | 실제 저장·조회 결과와 화면 일치 | `api/client.ts` |
| 로그인 유지 | 랜딩 이동 시 로그인 버튼이 다시 보여 로그아웃처럼 보임 | 전역 `AuthProvider`와 사용자 상태 기반 헤더 적용 | 페이지 이동 중 로그인 상태 유지 | `auth/AuthContext.tsx`, `App.tsx` |
| 통합 내비게이션 | 랜딩과 진단 화면의 레이아웃 단절 | 공통 상단 탭과 보호 레이아웃 적용 | 하나의 서비스처럼 일관된 이동 | `SiteHeader.tsx`, `Layout.tsx` |
| 모바일 챗봇 | 화면이 좁아지면 우측 챗봇이 사라짐 | 모바일 탭과 `/chatbot` 전용 화면 추가 | 모바일에서도 챗봇 사용 가능 | `SiteHeader.tsx`, `ChatbotPage.tsx` |
| 인증 UI | 로그인·회원가입 구분이 약하고 API 주소가 노출됨 | 탭형 인증 UI, 개발용 API 표시 제거 | 목적이 명확한 인증 화면 | `Login.tsx` |
| 비밀번호 UX | 규칙과 확인 입력 부족 | 규칙 안내, 비밀번호 확인, 즉시 검증 추가 | 가입 실패 원인 사전 확인 | `Login.tsx` |
| 오류 안내 | 모든 오류가 API 연결 오류로 표시됨 | 상태·필드별 사용자 메시지와 상세 안내 적용 | 이메일 중복 등 원인을 직접 확인 | `errorPresentation.ts`, `UI.tsx` |
| 프로필 입력 | 모든 선택 정보가 항상 노출됨 | 혼인·자녀·무주택·부양 조건별 입력 노출 및 값 초기화 | 입력 부담 감소, 잘못된 숨은 값 방지 | `Profile.tsx` |
| 프로필 선택지 | 혼인 상태와 모름 선택지가 과도하게 세분화·중복 | 혼인 상태 최소화, 중복 선택 문구 제거 | 선택 판단 단순화 | `Profile.tsx` |
| 진단 기록 | 저장된 전략 결과 재조회 화면 부족 | 마이페이지 기록 목록과 상세 이동 추가 | 이전 진단 재확인 가능 | `MyPage.tsx`, `routes.tsx` |
| 결과 매핑 | 상세 전략 Markdown과 누락 항목 매핑 불완전 | 요약·전략 구조화, 중첩 누락·경고 항목 수집 | 결과 가독성과 확인 가능성 향상 | `ResultDetail.tsx` |
| 원본 응답 노출 | FastAPI payload·API 배지가 화면에 노출됨 | 원본 payload와 기술 메타데이터 제거 | 사용자 화면 단순화·내부 구조 비노출 | `ResultDetail.tsx`, `UI.tsx` |
| 장시간 요청 | 중복 상태 박스와 이동 가능성 | 실행 중 버튼·입력 비활성화, 타임아웃과 스피너 유지 | 중복 요청 방지 | `StrategyRun.tsx`, `PdfAnalysis.tsx` |
| 챗봇 질문 | 화면 데이터를 읽는 것처럼 보이는 모호한 추천 질문 | 독립적으로 답할 수 있는 청약 제도 질문으로 교체 | 답변 정확도와 기대 일치 | `ChatbotPanel.tsx` |
| 챗봇 레이아웃 | 입력창이 메시지 영역 안에 있고 빈 공간이 큼 | 하단 고정 입력창, 추천 질문, 타이핑 표시 개선 | 채팅 앱과 유사한 사용성 | `ChatbotPanel.tsx` |
| 챗봇 맥락 | 패널 재마운트 시 메시지와 세션 소실 | 메시지·`session_id`를 `sessionStorage`에 저장, 새 대화 기능 추가 | 브라우저 탭 세션 동안 후속 질문 유지 | `ChatbotPanel.tsx` |
| 랜딩 비주얼 | 히어로·단계 이미지 크기와 정적 화면 | 반응형 크기, 순차 등장, 배경 이동, 부유 모션 추가 | 서비스 첫 화면 집중도 향상 | `Home.tsx`, `styles/index.css` |
| 접근성 | 랜딩 모션이 사용자 설정을 고려하지 않음 | `prefers-reduced-motion` 대응 | 모션 민감 사용자 보호 | `styles/index.css` |

## 2. 2026-07-06 커밋·작업 근거

| 구분 | 내용 |
|---|---|
| 커밋 `d6723ba` | 서비스 데모 범위 명확화, 랜딩 비주얼 개선 |
| 커밋 `63ff69e` | UI/UX 개선, mock 응답 제거, 상세 전략 매핑 보완 |
| 커밋 `fd241f5` | UI/UX 개선, mock 응답 제거, 상세 전략 매핑 보완 |
| 미커밋 작업 | 챗봇 패널 개선, 세션 유지, 랜딩 모션, 중복 분석 안내 제거 |

## 3. 검증 기록

| 검증 | 결과 |
|---|---|
| `pnpm.cmd test` | 자동 계약 테스트 7/7 통과 |
| `pnpm.cmd run build` | Vite production build 통과 |
| 백엔드 파일 변경 확인 | Django/FastAPI 변경 없음 |
| API 내부 정보 노출 검색 | 화면용 API 배지·원본 payload 제거 확인 |

## 4. 남은 개선 사항

- React Testing Library·Vitest 기반 실제 DOM 상호작용 테스트
- Playwright 기반 로그인·프로필·진단 E2E 회귀 테스트
- 운영 CSRF 적용 후 인증 흐름 재검증
- 진단 상세 조회 스켈레톤
- 접근성 자동 검사와 키보드 탐색 점검
- 프론트 Dockerfile·Nginx SPA fallback·CI 추가

## 5. `version-1-integrate-0706` UI 재통합

통합 커밋: `0f1f3a6`

팀원의 후속 통합 과정에서 빠진 `eunjin/frontend` UI 개선 커밋 `7f7acd4`, `b508dfb`를 최신 `version-1-integrate-0706` 기준으로 다시 적용했다.

### 반영 내용

- AFIT 로고, 브라우저 탭 이름, favicon
- 아파트 분양 청약 데모 범위와 랜딩 문구
- 로그인·회원가입 구분과 비밀번호 규칙 완료 상태
- 조건부 프로필 입력과 금액 천 단위 콤마
- 저장 중·완료·실패 상태와 중복 요청 방지
- 아파트 분양 공고 진단 범위 안내
- 결과 상세 구조와 참고용 진단 안내
- 반응형 챗봇 전용 화면과 세션 유지

### 충돌 처리와 보존 범위

- `SiteHeader.tsx`는 통합 브랜치의 역할·API 흐름 주석을 유지하고 AFIT UI를 결합했다.
- `index.html`은 기존 메타데이터를 유지하고 AFIT 제목·favicon만 결합했다.
- 최신 API client, 인증, MyPage, Vite proxy 등 팀원의 프론트 로직은 덮어쓰지 않았다.
- Django·FastAPI 및 기타 비프론트 코드는 변경하지 않았다.

### 검증

- `pnpm.cmd run build`: 통과
- `pnpm.cmd test`: 7/7 통과
- UI 코드 커밋의 변경 경로: `frontend-react` 내부 12개 파일

## 6. 2026-07-07 `eunjin/frontend-v2` 추가 UI 반영

작업 브랜치: `integrate-eunjin-v2-0707`
반영 커밋: `8a05300`

### 반영 내용

- 마이페이지 진단 기록 카드 제목을 공고명/아파트명 중심으로 표시
- 결과 상세 화면에 공고 기본 정보 카드 추가
- 상세 확인 사항을 접고 펼칠 수 있는 UI로 정리
- `announcementPresentation.ts`를 추가해 `announcement_confirmed`와 `input_snapshot.announcement`를 함께 읽도록 구성
- 전략 진단 범위 안내 문구를 "추후 지원 예정"으로 완화
- 챗봇 패널의 새로고침 안내 문구 제거

### 보존한 계약

- `ResultDetail.tsx`의 `missing_fields + missing_items` 동시 대응 유지
- `chance -> competitiveness -> status -> score` fallback 유지
- `report.finance`, `report.strategy`, `node5.agent_result`, `warnings` 표시 대응 유지

### 검증

- `corepack pnpm test`: 7/7 통과
- `corepack pnpm run build`: 통과
