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

fixture의 enum 값은 `4차_청약_입력필드_null_enum_설계안.md`와 `4차_API_데이터_계약.md` 기준으로 고정한다. enum 추가·삭제·이름 변경은 계약 변경 절차를 거친다.

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
