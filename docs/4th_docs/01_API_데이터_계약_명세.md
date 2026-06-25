# 01. API·데이터 계약 명세

## 1. 문서 목적

본 문서는 4차 프로젝트의 공개 API, 데이터 필드명, enum, null 정책, 프로필·공고·전략 payload, 3차 필드와의 adapter 기준을 정의합니다. 구현 중 필드명·타입·null 규칙이 충돌하면 본 문서를 우선 기준으로 삼습니다.

| 항목 | 내용 |
|---|---|
| 통합 전 참조자료 | 기존 API 계약, CRUD 명세, 청약 입력필드 설계안, 필드 어댑터 명세서를 통합 반영 |
| 계약 소유 | B: Tech Lead + Integration |
| 구현 책임 | C: Django 공개 API, D: FastAPI/AI 내부 API |
| 사용자 용어 승인 | A: PM + React |

## 2. 공통 규칙

| 규칙 | 기준 |
|---|---|
| API 경로 | MVP에서는 `/api/...`를 사용합니다. |
| 명명 규칙 | API JSON, Python, DB 컬럼은 `snake_case`를 사용합니다. |
| 금액 | 정수 원 단위이며 `_krw` suffix를 붙입니다. |
| 면적 | 제곱미터는 `_sqm` suffix를 붙입니다. |
| 개수 | 개수는 `_count` suffix를 붙입니다. |
| 기간 | 기간은 `_years` 또는 `_months` suffix를 붙입니다. |
| 날짜 | 날짜는 `YYYY-MM-DD`, 시각은 UTC RFC 3339를 사용합니다. |
| ID | UUID 문자열을 사용합니다. |
| boolean | `is_`, `has_`, `wants_`로 시작합니다. |
| enum | `UPPER_SNAKE_CASE`를 사용합니다. |

## 3. null 정책

`null`, `0`, `false`, omitted는 서로 다른 의미입니다.

| 값 | 의미 |
|---|---|
| `null` | 사용자가 모르는 값 또는 아직 입력하지 않은 값 |
| `0` | 사용자가 명시한 실제 0 |
| `false` | 사용자가 명시한 아니오 |
| PATCH에서 필드 미포함 | 기존 값 유지 |

누락값 때문에 전체 진단을 실패시키지 않습니다. 공통 필수값이 없으면 `400`으로 처리하고, 특정 공급유형의 세부값이 없으면 해당 섹션만 `PARTIAL` 또는 `SKIPPED_MISSING_INPUTS`로 반환합니다.

## 4. 핵심 enum

```text
BankbookType:
  HOUSING_SUBSCRIPTION_COMPREHENSIVE | SUBSCRIPTION_SAVINGS |
  SUBSCRIPTION_DEPOSIT | SUBSCRIPTION_INSTALLMENT | UNKNOWN

MaritalStatus:
  SINGLE | MARRIED | ENGAGED | DIVORCED | WIDOWED | UNKNOWN

YoungestChildAgeGroup:
  UNDER_2 | AGE_2_TO_6 | AGE_7_TO_18 | ADULT_OR_NONE | UNKNOWN

ElderlySupportStatus:
  MEETS_65_AND_3Y | DOES_NOT_MEET | UNKNOWN

SupplyCategory:
  PRIVATE | NATIONAL_PUBLIC | PUBLIC_HOUSING | UNKNOWN

HousingType:
  PRIVATE_HOUSING | NATIONAL_HOUSING | PUBLIC_HOUSING | PUBLIC_RENTAL | UNKNOWN

RegulatedAreaType:
  SPECULATION_OVERHEATED | SUBSCRIPTION_OVERHEATED |
  ADJUSTMENT_TARGET | NON_REGULATED | UNKNOWN

SpecialSupplyType:
  NEWLYWED | MULTI_CHILD | FIRST_LIFE | ELDERLY_PARENT_SUPPORT |
  INSTITUTION_RECOMMENDED | NEWBORN | YOUTH |
  SINGLE_PARENT_FAMILY | RELOCATED_INSTITUTION_WORKER |
  FOREIGN_SPECIAL_CASE | OTHER

DiagnosisRunStatus:
  PENDING | RUNNING | SUCCEEDED | FAILED

ExtractionFieldStatus:
  EXTRACTED | MISSING | NEEDS_REVIEW | USER_CONFIRMED | USER_CORRECTED

AnalysisStatus:
  CALCULATED | PARTIAL | SKIPPED_MISSING_INPUTS |
  NOT_APPLICABLE | NEEDS_USER_CONFIRMATION
```

`ChildStatus`는 공개 API 필수 enum에서 제거합니다. 자녀 여부는 `minor_child_count`에서 파생합니다.

## 5. 사용자 프로필 계약

### 5.1 기본 진단에서 직접 입력하는 P0 필드

| 필드 | 타입 | 조건 |
|---|---|---|
| `bankbook_type` | enum | 필수 |
| `bankbook_join_date` | date | 필수, 미래일 불가 |
| `bankbook_payment_count` | integer | 필수, 0 이상 |
| `bankbook_balance_krw` | integer | 필수, 0 이상 |
| `residence_region` | string/code | 필수 |
| `is_homeless` | boolean | 필수 |
| `is_household_head` | boolean | 필수 |
| `household_member_count` | integer | 필수, 본인 포함 1 이상 |
| `birth_year` | integer | 필수, 1900 이상 서버 현재연도 이하 |
| `marital_status` | enum | 필수 |
| `minor_child_count` | integer | 필수, 0 이상 |
| `has_household_property_ownership_history` | boolean | 필수 |

### 5.2 조건부 또는 추가 확인 필드

| 필드 | 타입 | 용도 |
|---|---|---|
| `residence_period_years` | integer/null | 지역 우선공급 판단 |
| `homeless_period_years` | integer/null | 무주택기간 가점 |
| `marriage_period_years` | integer/null | 신혼부부 특별공급 |
| `is_dual_income` | boolean/null | 신혼부부 소득 기준 |
| `monthly_household_income_krw` | integer/null | 소득 기준 |
| `total_assets_krw` | integer/null | 공공주택 자산 기준 |
| `dependent_family_count` | integer/null | 민영 가점 |
| `young_child_count` | integer/null | 다자녀·신생아 관련 판단 |
| `youngest_child_age_group` | enum/null | 자녀 연령 판단 |
| `has_income_tax_5_years` | boolean/null | 생애최초 특별공급 |
| `elderly_support_status` | enum/null | 노부모부양 특별공급 |
| `elderly_dependent_is_homeless` | boolean/null | 노부모부양 세부 판단 |
| `real_estate_assets_krw` | integer/null | 민영 일부 특공 자산 기준 |
| `vehicle_value_krw` | integer/null | 공공주택 자동차가액 |

## 6. 3차 필드 호환표

4차 공개 API 이름을 기존 FastAPI schema에 직접 넘기지 않습니다. Django→AI 경계의 adapter에서 한 번만 변환합니다.

| 4차 공개 필드 | 3차 실제 필드 | 처리 |
|---|---|---|
| `bankbook_payment_count` | `bankbook_payments` | 이름 변환 |
| `bankbook_balance_krw` | `bankbook_balance` | 이름 변환 |
| `bankbook_join_date` | `bankbook_joined_months` | 가입 개월 수 파생 |
| `residence_region` | `region` | 지역명 표준화 |
| `household_member_count` | `num_household_members` | 이름 변환 |
| `minor_child_count` | `child_count_group`, `has_two_or_more_minor_children` | 자녀 관련 파생값 생성 |
| `monthly_household_income_krw` | `average_monthly_income` | 이름 변환, null 보존 |
| `has_household_property_ownership_history` | `has_property_history` | 이름 변환, 세대 기준 의미 보존 |
| `total_assets_krw` | `total_assets` | 이름 변환 |
| `elderly_support_status` | `is_elderly_parent`, `elderly_parent_years` | `MEETS_65_AND_3Y`일 때 true·3년 이상으로 변환 |

파생값인 `housing_ownership`, `bankbook_joined_months`, `has_two_or_more_minor_children`는 React가 보내지 않습니다.

## 7. 공고 및 PDF 분석 계약

### 7.1 공고 입력

P0에서는 PDF 분석을 기본 흐름으로 두고, PDF가 없거나 분석이 실패하면 수동 공고 입력 fallback을 허용합니다. 사용자가 공고문 또는 공고 요약을 입력하면 Node 4 또는 PDF 분석 로직이 구조화합니다. 추출값은 사용자 확인 전에는 전략 진단 입력으로 확정하지 않습니다.

| 필드 | 타입 | validation |
|---|---|---|
| `announcement_text` | string/null | 수동 공고 입력. 값이 있으면 trim 후 빈 문자열 불가 |
| `announcement_name` | string/null | 선택. 값이 있으면 trim 후 빈 문자열 불가 |
| `region` | string/code | 공고 기반 진단이면 필수, trim 후 빈 문자열 불가 |
| `regulated_area_type` | enum | 모르면 `UNKNOWN` 허용 |
| `supply_category` | enum | 필수, `UNKNOWN` 불가 |
| `housing_type` | enum | 모르면 `UNKNOWN` 허용 |
| `sale_price_krw` | integer/null | null 또는 0~10,000,000,000. 미상은 0이 아니라 null |
| `deposit_krw` | integer/null | null 또는 0~10,000,000,000. 미상은 0이 아니라 null |
| `area_text` | string | 필수, trim 후 빈 문자열 불가 |
| `exclusive_area_sqm` | number/null | null 또는 1~300 |
| `supply_household_count` | integer/null | null 또는 1~100000 |
| `application_start_date` | date/null | null 또는 `YYYY-MM-DD` |
| `application_end_date` | date/null | null 또는 `YYYY-MM-DD`, `application_start_date`보다 이전 불가 |
| `special_supply_types_available` | enum[]/null | null 또는 `SpecialSupplyType[]`, 중복 불가 |

문자열 필드는 trim 후 검증합니다. 필수 문자열의 빈 값은 validation error입니다. nullable 필드라도 빈 문자열을 서버가 임의로 null로 바꾸지 않습니다.

### 7.2 PDF 분석

`POST /api/pdf/analyze`는 추출값과 검토 필요 필드를 분리해 반환합니다. 사용자가 확정하기 전에는 전략 진단에 자동 반영하지 않습니다.

## 8. 공개 CRUD API

| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/auth/signup` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `POST` | `/api/auth/logout` | 로그아웃 |
| `GET` | `/api/auth/me` | 현재 사용자 조회 |
| `DELETE` | `/api/auth` | 계정 소프트 삭제 |
| `GET` | `/api/user/profile` | 내 프로필 조회 |
| `PUT` | `/api/user/profile` | 내 프로필 전체 저장/수정 |
| `PATCH` | `/api/user/profile` | 내 프로필 일부 수정 |
| `POST` | `/api/strategy` | 전략 진단 생성 |
| `GET` | `/api/strategy/me` | 내 전략 목록 조회 |
| `GET` | `/api/strategy/{strategy_id}` | 전략 상세 조회 |
| `POST` | `/api/chatbot` | 챗봇 질문 |
| `POST` | `/api/pdf/analyze` | PDF 공고 분석 |

### 8.1 계정 삭제 계약

`DELETE /api/auth`는 MVP에서 소프트 삭제로 처리합니다. 서버는 계정을 즉시 물리 삭제하지 않고 비활성 상태로 전환하며, 이후 로그인과 보호 API 접근을 차단합니다.

| 항목 | 기준 |
|---|---|
| 삭제 방식 | 소프트 삭제 |
| 세션 처리 | 삭제 요청 성공 후 현재 세션 무효화 |
| 재가입/복구 | P0 범위 밖. 필요 시 후속 정책으로 결정 |

### 8.2 전략 결과 저장 계약

`POST /api/strategy`는 진단 실행마다 전체 strategy result를 저장합니다. 결과 재조회 안정성을 위해 입력 snapshot도 함께 저장합니다.

| 저장 항목 | 기준 |
|---|---|
| 프로필 입력 snapshot | 진단 실행 시점의 공개 프로필 필드 |
| 공고 입력 snapshot | PDF 분석 확정값 또는 수동 공고 입력값 |
| 전략 결과 payload | 공급유형별 상태, 누락 필드, 경고, 설명 |
| 저장 단위 | 최근 결과만 덮어쓰지 않고 실행마다 저장 |

### 8.3 챗봇 질문 계약

`POST /api/chatbot`은 React가 호출하는 공개 API입니다. React는 FastAPI/RAG를 직접 호출하지 않고, Django가 사용자 인증과 권한을 확인한 뒤 내부 FastAPI/RAG 챗봇으로 전달합니다.

#### 요청

```json
{
  "question": "청약통장 가입일은 왜 필요한가요?",
  "session_id": null
}
```

| 필드 | 타입 | 조건 |
|---|---|---|
| `question` | string | 필수, trim 후 빈 문자열 불가 |
| `session_id` | uuid string/null | 선택. 기존 챗봇 대화 thread를 이어갈 때 사용하며, 없으면 서버가 새 값을 발급 |

P0에서는 챗봇 대화 이력을 DB에 저장하지 않습니다. 단, RAG 대화 thread 유지를 위해 `session_id`는 응답에 포함할 수 있습니다.

#### 응답

```json
{
  "data": {
    "answer": "청약통장 가입일은 가입기간과 순위 판단에 사용됩니다.",
    "sources": ["주택청약 FAQ"],
    "session_id": "77777777-7777-7777-7777-777777777777"
  },
  "error": null,
  "request_id": "88888888-8888-8888-8888-888888888888"
}
```

| 필드 | 타입 | 조건 |
|---|---|---|
| `answer` | string | 필수 |
| `sources` | string[] | 필수, 출처가 없으면 빈 배열 |
| `session_id` | uuid string | 필수 |

## 9. 공통 응답 형식

### 성공

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

### 실패

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 입력값이 누락되었습니다.",
    "field_errors": {
      "missing_fields": ["bankbook_type", "residence_region"]
    }
  },
  "request_id": "uuid"
}
```

## 10. 주요 오류 코드

| 코드 | 사용 상황 |
|---|---|
| `PROFILE_REQUIRED` | 전략 진단에 필요한 사용자 프로필이 없음 |
| `PROFILE_REQUIRED_FIELDS_MISSING` | P0 공통 필수 프로필 필드가 누락됨 |
| `ANNOUNCEMENT_CONFIRMATION_REQUIRED` | PDF/LLM 추출값이 사용자 확인 전임 |
| `ANNOUNCEMENT_EXTRACTION_FAILED` | 공고문 구조화 실패 |
| `PDF_INVALID_TYPE` | PDF 형식이 아님 |
| `PDF_TEXT_NOT_FOUND` | 텍스트 추출 불가 |

## 11. 필드 어댑터 기준

필드 어댑터는 원본 입력을 덮어쓰지 않고, 계산용 컨텍스트를 별도로 생성합니다.

| 레이어 | 역할 |
|---|---|
| `RawProfileInput` | 사용자가 입력한 원본 값과 null 상태 보존 |
| `ProfileAdapter` | 금액, 지역명, 날짜, enum alias 정규화 |
| `CalculationContext` | 계산 가능한 값과 `missing_fields` 생성 |
| `DiagnosisResult` | 공급유형별 상태와 사용자 안내 반환 |

adapter는 `null`을 `0`이나 `false`로 바꾸지 않습니다. 계산 편의용 파생값은 내부 DTO에만 둡니다.

## 12. TypeScript/OpenAPI 기준

React API 타입은 Django DRF public OpenAPI에서 생성한 TypeScript 타입을 사용합니다. 필드 변경은 계약 PR로 처리하고, fixture와 OpenAPI 갱신을 함께 수행합니다.
