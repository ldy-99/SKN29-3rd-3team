# C. Django API 작업 가이드

## 1. 역할 요약

Django API 담당자는 4차 프로젝트의 공개 API와 데이터 저장을 담당합니다.  
브라우저는 Django만 호출하고, Django는 사용자 인증과 권한을 확인한 뒤 필요한 경우 FastAPI 내부 API를 호출합니다.

## 2. 우선 책임

| 영역 | 할 일 |
|---|---|
| 인증 | 회원가입, 로그인, 로그아웃, 현재 사용자 조회 |
| 세션/CSRF | session cookie 인증과 CSRF 방어 적용 |
| DB 모델 | 사용자 프로필, 진단 결과, 공고/PDF 분석 결과 저장 |
| 공개 API | React가 호출할 REST API 구현 |
| 권한 | 사용자별 데이터 소유권 보장 |
| FastAPI proxy | 필요한 경우 Django가 FastAPI를 내부 호출 |

## 3. 공개 API 우선순위

| 우선순위 | API | 목적 |
|---|---|---|
| 1 | `POST /api/auth/signup` | 회원가입 |
| 2 | `POST /api/auth/login` | 로그인 |
| 3 | `POST /api/auth/logout` | 로그아웃 |
| 4 | `GET /api/auth/me` | 현재 사용자 확인 |
| 5 | `GET/PUT/PATCH /api/user/profile` | 프로필 조회·저장·수정 |
| 6 | `POST /api/strategy` | 진단 실행 |
| 7 | `GET /api/strategy/me` | 내 진단 결과 목록 |
| 8 | `GET /api/strategy/{strategy_id}` | 진단 결과 상세 |
| 9 | `POST /api/chatbot` | 챗봇 질문 proxy |
| 10 | `POST /api/pdf/analyze` | PDF 공고 분석 |

## 4. 인증과 CSRF 기준

MVP에서는 Django session cookie를 사용합니다. JWT는 사용하지 않습니다.

| 항목 | 기준 |
|---|---|
| 인증 방식 | Django session cookie |
| React 요청 | `credentials: "include"` 사용 |
| 상태 변경 요청 | CSRF 토큰 포함 |
| 운영 쿠키 | `Secure=True`, `HttpOnly=True`, `SameSite=Lax` |
| 로컬 개발 | HTTP 환경에서는 Secure 옵션을 개발 설정으로 분리 |

## 5. DB 모델 설계 기준

처음부터 과도하게 복잡한 모델을 만들지 않습니다. P0 흐름에 필요한 저장 단위를 먼저 둡니다.

| 모델 후보 | 저장 내용 |
|---|---|
| `UserProfile` | 청약통장, 거주, 무주택, 세대, 혼인/자녀, 소득/자산 |
| `StrategyRun` | 진단 실행 상태, 입력 snapshot, 결과 payload |
| `AnnouncementInput` | PDF 분석 결과 또는 수동 공고 fallback 입력 |
| `ChatLog` | P1 후보. P0에서는 저장 없이 proxy만 가능 |

중요한 점은 진단 결과가 이후에도 재조회 가능해야 한다는 것입니다. 따라서 결과 저장 시 입력 snapshot도 함께 저장하는 방향이 안전합니다.

## 6. FastAPI 호출 기준

FastAPI는 내부 AI API입니다. Django에서만 호출합니다.

```text
React
  → Django DRF
  → 사용자 인증/권한 확인
  → FastAPI 내부 호출
  → Django가 응답 정리
  → React 반환
```

Django는 FastAPI 응답을 그대로 노출하기보다, 공개 API 계약에 맞게 정리해서 반환합니다.

## 7. 오류 응답 기준

공통 응답 형식을 맞춥니다.

```json
{
  "data": null,
  "error": {
    "code": "PROFILE_REQUIRED_FIELDS_MISSING",
    "message": "필수 입력값이 누락되었습니다.",
    "field_errors": {
      "missing_fields": ["bankbook_type", "residence_region"]
    }
  },
  "request_id": "uuid"
}
```

## 8. 구현 체크리스트

| 체크 | 질문 |
|---|---|
| 인증 | 로그인하지 않은 사용자가 보호 API를 호출하면 차단되는가? |
| 소유권 | 다른 사용자의 profile/result를 조회할 수 없는가? |
| null | 사용자가 모르는 값이 `0`이나 `false`로 바뀌지 않는가? |
| migration | DB 변경 후 migration이 생성되었는가? |
| FastAPI | 내부 호출 실패 시 구조화된 오류를 반환하는가? |
| fixture | 계약 fixture로 API 응답을 검증했는가? |

## 9. PR 전 확인

- API 경로와 필드명이 `01_API_데이터_계약_명세.md`와 맞는지 확인합니다.
- 인증, 권한, CSRF 영향을 PR에 적습니다.
- DB migration이 있으면 영향 범위를 적습니다.
- FastAPI 내부 호출이 추가되면 timeout과 실패 응답을 함께 처리합니다.
