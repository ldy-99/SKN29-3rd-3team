# API 계약

기준일: 2026-07-02
공개 base URL: `http://127.0.0.1:8000/api`

## 1. 공통 규칙

| 항목 | 규칙 |
|---|---|
| JSON 필드 | `snake_case` |
| 금액 | 정수 원 단위, `_krw` suffix |
| 면적 | 제곱미터, `_sqm` suffix |
| 날짜 | `YYYY-MM-DD` |
| ID | UUID 문자열 |
| 인증 | Django session cookie |
| React fetch | `credentials: "include"` |

`null`, `0`, `false`, PATCH에서 누락된 필드는 서로 다른 값입니다. 공개 API에서 받은 `null`을 adapter가 임의의 `0`이나 `false`로 바꾸지 않는 것이 원칙입니다.

## 2. 공통 응답

성공:

```json
{
  "data": {},
  "error": null,
  "request_id": "uuid"
}
```

실패:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "요청을 처리할 수 없습니다.",
    "field_errors": {}
  },
  "request_id": "uuid"
}
```

모든 Django API 응답은 `EnvelopeJSONRenderer`가 이 형식으로 감쌉니다.

## 3. Endpoint

| Method | Endpoint | 인증 | 설명 |
|---|---|---:|---|
| `POST` | `/api/auth/signup` | 아니오 | 회원가입 후 자동 로그인 |
| `POST` | `/api/auth/login` | 아니오 | 로그인 및 session 발급 |
| `POST` | `/api/auth/logout` | 예 | 로그아웃 |
| `GET` | `/api/auth/me` | 예 | 현재 사용자 |
| `DELETE` | `/api/auth` | 예 | 사용자와 연관 데이터 물리 삭제 |
| `GET` | `/api/user/profile` | 예 | 내 프로필 |
| `POST` | `/api/user/profile` | 예 | 하위 호환용 partial upsert |
| `PUT` | `/api/user/profile` | 예 | 전체 upsert |
| `PATCH` | `/api/user/profile` | 예 | 일부 수정 |
| `POST` | `/api/strategy` | 예 | 전략 진단 실행 |
| `GET` | `/api/strategy/me` | 예 | 내 진단 목록 |
| `GET` | `/api/strategy/{strategy_id}` | 예 | 내 진단 상세 |
| `POST` | `/api/user/announcement` | 예 | 구조화 공고 저장 |
| `GET` | `/api/user/announcement/{id}` | 예 | 내 공고 상세 |
| `POST` | `/api/chatbot` | 예 | RAG 챗봇 질문 |
| `POST` | `/api/pdf/analyze` | 예 | PDF 프록시, 현재 end-to-end 미완료 |

## 4. 인증 요청

회원가입:

```json
{
  "email": "user@example.com",
  "password": "password",
  "username": "optional-name"
}
```

`username`을 생략하면 email을 username으로 사용합니다.

로그인:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

`email` 대신 `username`도 사용할 수 있습니다.

## 5. 프로필

PUT에서 필요한 공통 필드:

| 필드 | 타입 |
|---|---|
| `bankbook_type` | string |
| `bankbook_join_date` | date |
| `bankbook_payment_count` | integer |
| `bankbook_balance_krw` | integer |
| `residence_region` | string |
| `is_homeless` | boolean |
| `is_household_head` | boolean |
| `household_member_count` | integer, 1 이상 |
| `birth_year` | integer |
| `marital_status` | string |
| `minor_child_count` | integer |
| `has_household_property_ownership_history` | boolean |

조건부·추가 필드:

```text
is_dual_income
residence_period_years
homeless_period_years
marriage_period_years
monthly_household_income_krw
total_assets_krw
dependent_family_count
young_child_count
youngest_child_age_group
has_income_tax_5_years
elderly_support_status
elderly_dependent_is_homeless
real_estate_assets_krw
vehicle_value_krw
```

`marital_status`가 `MARRIED`이면 `is_dual_income`이 필요합니다. 현재 enum 필드는 Django `CharField`이므로 서버가 전체 enum 집합을 강제하지 않습니다. UI와 fixture에서 사용하는 값은 변경 전 테스트가 필요합니다.

프로필이 없을 때 `GET /api/user/profile`은 404를 반환하며 React는 이를 빈 프로필 작성 화면으로 처리합니다.

## 6. 전략 진단

수동 공고문:

```json
{
  "announcement_text": "모집공고문 주요 내용",
  "profile_only": false
}
```

기본 프로필 진단:

```json
{
  "announcement_text": null,
  "profile_only": true
}
```

응답의 기본 필드:

```text
id
strategy_id
status
input_snapshot
result_payload
created_at
updated_at
```

FastAPI `result_payload`의 최상위 키는 현재 응답 adapter가 같은 레벨에도 펼칩니다. React는 과도기적으로 두 형태를 모두 처리하지만, 장기적으로 한 응답 형태로 고정해야 합니다.

상태:

```text
PENDING | RUNNING | SUCCEEDED | FAILED
```

## 7. 구조화 공고

`POST /api/user/announcement` 주요 필드:

```text
announcement_text
announcement_name
region
regulated_area_type
supply_category
housing_type
sale_price_krw
deposit_krw
area_text
exclusive_area_sqm
supply_household_count
application_start_date
application_end_date
special_supply_types_available
```

`region`, `supply_category`, `area_text`는 모델 기준 필수입니다. 가격은 0원 이상 100억 원 이하, 전용면적은 1~300㎡, 공급 세대수는 1~100,000 범위입니다.

## 8. 챗봇

요청:

```json
{
  "question": "무주택 기간은 어떻게 계산하나요?",
  "session_id": null
}
```

`question`은 trim 후 빈 문자열일 수 없습니다. `session_id`가 없으면 FastAPI가 새 대화 session을 발급할 수 있습니다. Django는 FastAPI 응답을 공통 envelope로 감싸 반환합니다.

## 9. PDF

React 업로드 화면과 Django `POST /api/pdf/analyze`는 존재합니다. Django는 PDF MIME/확장자를 검사한 뒤 FastAPI `/api/pdf/analyze`로 전달합니다.

현재 FastAPI에는 해당 endpoint가 없습니다. 따라서 이 API는 end-to-end 완료 계약이 아니며 MVP에서는 수동 공고문 입력을 사용합니다.

## 10. 오류 코드

| HTTP | 코드 | 상황 |
|---:|---|---|
| 400 | `PROFILE_REQUIRED_FIELDS_MISSING` | 프로필 필수값 누락 |
| 400 | `PDF_INVALID_TYPE` | PDF가 아닌 파일 |
| 401/403 | DRF 인증 코드 | 로그인 또는 권한 없음 |
| 404 | `NOT_FOUND` 계열 | 프로필·결과·공고 없음 |
| 429 | throttle 오류 | 사용자 요청 제한 초과 |
| 502 | `FASTAPI_CONNECTION_FAILED` | FastAPI 연결, timeout 또는 5xx |

프로필 자체가 없을 때는 `PROFILE_REQUIRED`를 사용하도록 의도돼 있습니다. 현재 일부 ValidationError 경로는 공통 handler 기본 코드로 합쳐질 수 있으므로 오류 코드 변경 시 테스트를 먼저 추가해야 합니다.

## 11. Django → FastAPI adapter

주요 변환:

| 공개 필드 | FastAPI 필드 |
|---|---|
| `bankbook_payment_count` | `bankbook_payments` |
| `bankbook_balance_krw` | `bankbook_balance` |
| `bankbook_join_date` | `bankbook_join_date`, `bankbook_joined_months` |
| `residence_region` | `region` |
| `household_member_count` | `num_household_members` |
| `monthly_household_income_krw` | `average_monthly_income` |
| `total_assets_krw` | `total_assets` |

파생값은 Django `strategy/adapters.py`에서만 생성합니다. React에 FastAPI 내부 필드명을 노출하지 않습니다.

## 12. 내부 FastAPI API

| Method | Endpoint | 용도 |
|---|---|---|
| `GET` | `/health` | 상태 확인 |
| `POST` | `/api/profile` | 프로필 입력, session 생성 |
| `POST` | `/api/simulate` | 기본·상세 진단 분기 |
| `POST` | `/api/announcement` | 공고문 반영 및 상세 결과 |
| `POST` | `/api/chat` | RAG 챗봇 |

이 endpoint는 브라우저용 공개 API가 아닙니다.
