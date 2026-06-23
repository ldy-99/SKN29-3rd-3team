# B. Tech Lead + Integration 작업 가이드

## 1. 역할 요약

Tech Lead + Integration 담당자는 팀 전체가 같은 계약을 보고 개발하도록 API, fixture, PR, CI, 문서 기준을 관리합니다.  
직접 모든 기능을 구현하는 역할이 아니라, 각 파트가 서로 맞물리도록 경계를 정하고 막히는 지점을 빠르게 풀어주는 역할입니다.

## 2. 우선 책임

| 영역 | 할 일 |
|---|---|
| API 계약 | 공개 API 경로, payload, 응답 형식, 오류 코드를 고정합니다. |
| 데이터 계약 | 필드명, 타입, enum, null 정책을 관리합니다. |
| 통합 흐름 | React → Django → FastAPI 연결 기준을 관리합니다. |
| CI/PR | 최소 테스트와 리뷰 기준을 정리합니다. |
| 문서 취합 | 결정 로그와 변경 사항을 문서에 반영합니다. |

## 3. Day 1~2 핵심 산출물

| ID | 산출물 | 완료 기준 |
|---|---|---|
| O1 | P0·제외 범위 승인 | 회의 결정 로그에 남김 |
| O3 | 공개 필드와 3차 필드 mapping | adapter 표 승인 |
| O5 | 계약 fixture 5종 | JSON parse와 기대값 확인 |
| O8 | FastAPI 실행 방식 선택 | HTTP/local 중 하나 결정 |
| O9 | 최소 CI | CI 1회 통과 또는 실행 명령 확정 |
| O11 | Day 3 작업 카드 | 담당자, reviewer, PR 단위 지정 |

## 4. 계약 관리 방식

계약은 아래 순서로 관리합니다.

```text
필드명 확정
  → null/enum 정책 확정
  → 요청/응답 fixture 작성
  → React·Django·FastAPI 담당자 검토
  → 구현 시작
```

계약 변경이 필요하면 기능 코드부터 바꾸지 않습니다. 먼저 계약 문서와 fixture를 수정한 뒤 각 파트가 따라오도록 합니다.

## 5. 최소 fixture 권장안

| fixture | 목적 |
|---|---|
| `profile-basic-p0.json` | P0 공통 필수 프로필 |
| `profile-partial.json` | 선택 필드가 비어 있는 부분 프로필 |
| `profile-invalid.json` | 필수값·형식 오류 검증 |
| `strategy-request-profile-only.json` | 공고 없는 기본 진단 요청 |
| `strategy-request-announcement.json` | 공고 기반 진단 요청 |
| `strategy-response-profile-only-partial.json` | 프로필 기반 부분 진단 응답 |
| `strategy-response-partial.json` | 공고 기반 부분 진단 응답 |
| `pdf-analyze-response-needs-review.json` | PDF 분석 후 검토 필요 응답 |
| `error-profile-required-fields-missing.json` | P0 필수 프로필 누락 오류 |
| `error-announcement-confirmation-required.json` | 미확정 공고값 사용 오류 |

fixture는 실제 API 구현 전에도 프론트와 백엔드가 같은 구조를 보게 하는 기준입니다.

## 6. PR 관리 기준

| 항목 | 기준 |
|---|---|
| PR 크기 | 리뷰 가능한 작은 단위 |
| 필수 내용 | 목적, 변경 내용, 테스트 결과, 영향 범위 |
| 계약 변경 | 단독 병합 금지. A/C/D 확인 필요 |
| 화면 변경 | 캡처 포함 |
| API 변경 | fixture와 문서 함께 수정 |

## 7. CI 최소 기준

| 영역 | 최소 검증 |
|---|---|
| React | lint 또는 build |
| Django | migration check, API fixture test |
| FastAPI/AI | import test, fixture diagnosis test |
| 문서 | 핵심 명세 파일 존재 여부 |

처음부터 완벽한 CI를 만들기보다, 매일 깨지는 부분을 빠르게 발견하는 수준부터 시작합니다.

## 8. 막혔을 때 조정 기준

| 상황 | 조정 |
|---|---|
| API 계약이 늦어짐 | 기능 개발보다 fixture와 필드 계약부터 고정합니다. |
| FastAPI 연결이 불안정 | HTTP/local 중 안정적인 방식 하나로 줄입니다. |
| PDF 분석이 늦어짐 | 수동 공고 입력 fallback으로 진단 흐름을 유지하되, `/api/pdf/analyze` P0 계약은 유지합니다. |
| ChromaDB 준비가 늦어짐 | 챗봇 scope를 고정 질문 smoke test로 축소합니다. |
| 배포가 늦어짐 | 로컬 재현성과 CI 통과를 먼저 확보합니다. |

## 9. PR 전 확인

- 계약 변경이 문서와 fixture에 반영되었는지 확인합니다.
- 각 담당자가 같은 API 필드명을 쓰는지 확인합니다.
- FastAPI가 브라우저에 직접 노출되지 않는지 확인합니다.
- Day 3 착수 기준을 매일 점검합니다.
