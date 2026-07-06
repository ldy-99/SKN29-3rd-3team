# API Contract Fixtures

이 폴더는 4차 MVP의 React, Django, FastAPI 계약 테스트에 사용할 JSON fixture 초안이다.

## 적용 기준

- 공개 API 경로: `/api/...`
- 공통 응답 envelope: `{ "data": ..., "error": ..., "request_id": "uuid" }`
- 프로필 P0 공통 필수 필드: 12개
- `child_status`는 공개 API 필수값에서 제외
- `is_dual_income`은 조건부/null 허용
- 공고문 없이 `POST /api/strategy` 실행 가능
- PDF 분석은 P0이며, 추출값은 사용자 확인 전 `NEEDS_REVIEW`

## enum 기준

fixture의 필드와 값은 `docs/current/API_CONTRACT.md` 기준으로 관리한다. 계약 변경 시 코드, fixture, 문서를 함께 수정한다.

- `BankbookType`
- `MaritalStatus`
- `SupplyCategory`
- `HousingType`
- `RegulatedAreaType`
- `YoungestChildAgeGroup`
- `ElderlySupportStatus`
- `SpecialSupplyType`
- `AnalysisStatus`
- `ExtractionFieldStatus`

## Day 2 최소 fixture 매핑

| 구분 | 파일 |
|---|---|
| 정상 프로필 | `profile-basic-p0.json` |
| 필수값 누락 | `profile-invalid.json`, `error-profile-required-fields-missing.json` |
| 부분 진단 | `profile-partial.json`, `strategy-response-profile-only-partial.json`, `strategy-response-partial.json` |
| 공고 입력/PDF fallback | `strategy-request-announcement.json`, `pdf-analyze-response-needs-review.json`, `error-announcement-confirmation-required.json` |
| 챗봇 질문 | `chatbot-request-question.json`, `chatbot-response-answer.json` |
