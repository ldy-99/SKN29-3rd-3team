# 프로젝트 문서 색인

문서는 용도별 폴더로 나누어 관리합니다. 처음 보는 사람은 아래 순서대로 보면 현재 브랜치의 구조와 통합 상황을 가장 빠르게 파악할 수 있습니다.

## 먼저 볼 문서

| 순서 | 목적 | 문서 |
|---|---|---|
| 1 | 2026-07-06 통합 현황, 서비스 흐름, 동윤님/은진님 전달 메모 | [current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md](current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md) |
| 2 | FastAPI/Django/React가 맞춰야 하는 응답 필드 기준 | [current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md](current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md) |
| 3 | 현재 `version-1` 계열 구조와 실행 체크포인트 | [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md) |
| 4 | 기존 공개 API 계약 | [current/API_CONTRACT.md](current/API_CONTRACT.md) |

## 폴더 구성

| 폴더 | 용도 |
|---|---|
| [current/](current/) | 현재 구조, API 계약, 제품 범위처럼 팀원이 기준으로 삼아야 하는 문서 |
| [guides/](guides/) | 실행, 협업, 브랜치 공유처럼 따라 하는 절차 문서 |
| [traces/](traces/) | 정상화·통합 과정에서 무엇을 왜 바꿨는지 남긴 작업 기록 |
| [frontend/](frontend/) | 프론트 화면설계, 요구사항 추적, 테스트 결과, 개선 기록 |
| [reports/](reports/) | 기존 AI/RAG 설계·품질·아키텍처 분석 보고서 |
| [assets/](assets/) | 보고서와 문서에서 사용하는 이미지/SVG 자료 |

## 기준 문서

| 확인하려는 내용 | 문서 |
|---|---|
| 현재 통합 브랜치 구조와 전달 메모 | [current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md](current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md) |
| 2026-07-06 기준 FastAPI 응답 계약 | [current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md](current/VERSION1_API_RESPONSE_CONTRACT_2026_07_06.md) |
| `version-1` 통합 브랜치의 현재 구조와 정상화 요약 | [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md) |
| 지금 전체 현황을 빠르게 파악 | [current/CURRENT_STATUS.md](current/CURRENT_STATUS.md) |
| MVP 범위, 구조, 현재 상태 | [current/PROJECT_SPEC.md](current/PROJECT_SPEC.md) |
| API 경로, 요청·응답, 필드 | [current/API_CONTRACT.md](current/API_CONTRACT.md) |

## 실행·협업 가이드

| 확인하려는 내용 | 문서 |
|---|---|
| `final-debug-share` 브랜치에서 처음부터 실행 | [guides/FINAL_DEBUG_SHARE_GUIDE.md](guides/FINAL_DEBUG_SHARE_GUIDE.md) |
| 역할, 작업 순서, Git·PR·QA 규칙 | [guides/TEAM_GUIDE.md](guides/TEAM_GUIDE.md) |
| 현재 브랜치 실행과 검증 명령 | [../README.md](../README.md) |

## 작업 기록

| 확인하려는 내용 | 문서 |
|---|---|
| 통합·정리 작업 이력 | [traces/CHANGELOG.md](traces/CHANGELOG.md) |
| 문제 원인과 수정 근거 중심 기록 | [traces/fix-log.md](traces/fix-log.md) |
| `version-1` 정상화에서 바뀐 항목과 이유 | [traces/VERSION1_NORMALIZATION_TRACE.md](traces/VERSION1_NORMALIZATION_TRACE.md) |
| 2026-07-06 API 계약 정리 근거와 확인 기록 | [traces/VERSION1_API_CONTRACT_TRACE_2026_07_06.md](traces/VERSION1_API_CONTRACT_TRACE_2026_07_06.md) |
| 2026-07-06 dongyoon/eunjin 단계별 통합 판단 기록 | [traces/VERSION1_INTEGRATION_TRACE_2026_07_06.md](traces/VERSION1_INTEGRATION_TRACE_2026_07_06.md) |

## 프론트 문서

| 확인하려는 내용 | 문서 |
|---|---|
| 화면설계서 | [frontend/SCREEN_DESIGN.md](frontend/SCREEN_DESIGN.md) |
| 요구사항 추적표 | [frontend/REQUIREMENTS_TRACEABILITY.md](frontend/REQUIREMENTS_TRACEABILITY.md) |
| 테스트 결과 보고서 | [frontend/TEST_REPORT_2026-07-06.md](frontend/TEST_REPORT_2026-07-06.md) |
| 수정·개선 기록 | [frontend/FRONTEND_CHANGELOG_2026-07-06.md](frontend/FRONTEND_CHANGELOG_2026-07-06.md) |

## 문서 관리 원칙

- 새로 합류한 팀원에게는 먼저 `docs/README.md`와 `current/VERSION1_INTEGRATION_HANDOFF_2026_07_06.md`를 안내합니다.
- 공개 API 변경은 코드, [current/API_CONTRACT.md](current/API_CONTRACT.md), `fixture_examples/`를 함께 수정합니다.
- 제품 범위나 아키텍처 결정은 [current/PROJECT_SPEC.md](current/PROJECT_SPEC.md)에 반영합니다.
- 완료된 작업의 핵심 결과는 [traces/CHANGELOG.md](traces/CHANGELOG.md)에 기록합니다.
- 세부 판단 과정은 `traces/`에 남기되, 현재 기준 문서와 섞지 않습니다.
- 분석 보고서는 과거 설계 근거이므로 현재 운영 명세와 구분해서 사용합니다.
