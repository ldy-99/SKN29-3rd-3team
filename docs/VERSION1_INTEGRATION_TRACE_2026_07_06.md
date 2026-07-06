# version-1 통합 추적 기록

작업일: 2026-07-06  
작업 브랜치: `version-1-integrate-0706`  
기준: `origin/version-1` + `version-1-api-contract`

## 1. 통합 원칙

0706 현재 GitHub 기준 상태는 다음과 같다.

- jihun 백엔드 개선사항은 이미 `origin/version-1`에 병합되어 있다.
- dongyoon_v1은 최신 `origin/version-1` 위에 Django/일부 프론트 개선 커밋 1개가 올라간 상태다.
- eunjin/frontend는 jihun/dongyoon 최신화 이전 기준에서 프론트 작업이 진행되어, 최신 백엔드/장고 변경과 일부 충돌 가능성이 있다.

따라서 통합 순서는 다음으로 잡았다.

```text
1. 최신 version-1 기준 고정
2. dongyoon_v1의 Django/backend 성격 변경 우선 반영
3. 백엔드/Django 기준 검증
4. eunjin/frontend를 그 위에 통합
5. 프론트 충돌은 API 계약 기준으로 수동 해결
```

## 2. dongyoon_v1 확인 결과

추가 커밋:

```text
9c578c4 수정
```

변경 파일:

```text
django_backend/accounts/views.py
django_backend/accounts/tests.py
frontend-react/src/app/pages/Home.tsx
frontend-react/src/app/pages/Login.tsx
frontend-react/src/app/routes.tsx
frontend-react/vite.config.ts
🛠️ 작업 요약.txt
```

확인한 의도:

- 로그인 API 요청 횟수 제한 추가
- 로그인 throttle 테스트 추가
- 테스트 간 throttle cache 초기화
- Vite 개발 서버 proxy 추가
- 홈/로그인 화면에서 로그인 세션 유지 흐름을 임시 확인

## 3. 선별 반영한 항목

반영 파일:

- `django_backend/accounts/views.py`
- `django_backend/accounts/tests.py`
- `frontend-react/vite.config.ts`

반영 내용:

- `LoginRateThrottle` 추가
- `LoginAPIView.throttle_classes` 적용
- 로그인 10회까지 허용, 11회째 429 응답 테스트 추가
- 테스트 간 throttle cache가 누적되지 않도록 `setUp`/`tearDown`에서 `cache.clear()` 실행
- Vite dev server의 `/api` 요청을 `http://127.0.0.1:8000`으로 proxy

반영 이유:

- Django 로그인 보안 개선은 최신 백엔드 기준 통합본에 바로 포함해도 충돌 위험이 낮다.
- Vite proxy는 개발환경에서 React와 Django의 host/port 차이로 인한 session cookie 문제를 줄인다.
- 두 변경 모두 은진님 프론트 UI 통합 전에도 독립적으로 검증 가능하다.

## 4. 보류한 항목

보류 파일:

- `frontend-react/src/app/pages/Home.tsx`
- `frontend-react/src/app/pages/Login.tsx`
- `frontend-react/src/app/routes.tsx`
- `🛠️ 작업 요약.txt`

보류 이유:

- 현재 최신 `version-1`의 React client는 아직 mock fixture fallback과 `VITE_USE_MOCK_API` 기본값을 가진다.
- dongyoon_v1의 Home/Login 변경을 단독 반영하면 실제 로그인하지 않아도 mock user 때문에 로그인된 것처럼 보일 수 있다.
- eunjin/frontend에는 AuthContext, mock 제거, 보호 라우팅, MyPage/ChatbotPage 등 더 큰 프론트 개선이 들어 있다.
- 따라서 Home/Login/routes는 eunjin/frontend 통합 시 AuthContext 기준으로 함께 정리하는 것이 안전하다.
- 루트의 `🛠️ 작업 요약.txt`는 정보성 내용은 유용하지만, 루트 산출물로 유지하기보다 docs trace/changelog에 흡수하는 편이 낫다.

## 5. eunjin/frontend 통합 전 확인된 충돌 후보

dongyoon_v1과 eunjin/frontend 사이에서 겹치는 프론트 파일:

```text
frontend-react/src/app/pages/Home.tsx
frontend-react/src/app/pages/Login.tsx
frontend-react/src/app/routes.tsx
```

기존에 확인된 eunjin/frontend와 최신 version-1 사이의 주요 충돌 후보:

```text
frontend-react/src/app/pages/ResultDetail.tsx
```

통합 시 기준:

- 결과 상세 화면은 `docs/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md`의 필드 계약을 따른다.
- 로그인 상태 관리는 eunjin/frontend의 `AuthContext` 방식이 더 일관적이므로 우선 검토한다.
- Django 공개 API는 session cookie 기준이고, React는 Django API만 호출한다.

## 6. 다음 단계

1. Django/FastAPI/React build 검증
2. 현재 브랜치 커밋
3. eunjin/frontend를 비파괴 merge-tree로 한 번 더 확인
4. 충돌 해결 방안을 사용자에게 보고
5. 사용자 컨펌 후 실제 프론트 통합 진행

## 7. 1차 통합 검증 결과

dongyoon_v1의 Django 변경과 Vite proxy만 선별 반영한 뒤 다음 검증을 수행했다.

```text
git diff --check: OK
Django manage.py check: OK
Django accounts + strategy tests: 26 passed
FastAPI app import: OK
React production build: OK
```

검증 메모:

- 로그인 throttle 테스트가 추가되어 Django 테스트 수가 25개에서 26개로 증가했다.
- `Home.tsx`, `Login.tsx`, `routes.tsx`는 아직 반영하지 않았다.
- 해당 프론트 파일들은 eunjin/frontend 통합 시 AuthContext, mock 제거, 보호 라우팅 기준으로 다시 판단한다.
