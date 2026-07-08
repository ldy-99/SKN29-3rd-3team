# 프로젝트 문서 색인

문서는 용도별 폴더로 나누어 관리합니다. 처음 보는 사람은 아래 순서대로 보면 현재 브랜치의 구조와 통합 상황을 가장 빠르게 파악할 수 있습니다.

## 먼저 볼 문서

| 순서 | 목적 | 문서 |
|---|---|---|
| 1 | 현재 `version-1` 계열 구조와 실행 체크포인트 | [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md) |
| 2 | FastAPI/Django/React가 맞춰야 하는 응답 필드 기준 | [current/260706_VERSION1_API_RESPONSE_CONTRACT.md](current/260706_VERSION1_API_RESPONSE_CONTRACT.md) |
| 3 | PDF 분석 개선 현황과 팀 공유 요약 | [current/260707_VERSION1_PDF_ANALYSIS_STATUS.md](current/260707_VERSION1_PDF_ANALYSIS_STATUS.md) |

## 폴더 구성

| 폴더 | 용도 |
|---|---|
| [current/](current/) | 현재 구조, API 계약, 제품 범위처럼 팀원이 기준으로 삼아야 하는 문서 |
| [guides/](guides/) | 실행, 협업, 브랜치 공유처럼 따라 하는 절차 문서 |
| [traces/](traces/) | 정상화·통합 과정에서 무엇을 왜 바꿨는지 남긴 작업 기록 |
| [frontend/](frontend/) | 프론트 화면설계, 요구사항 추적, 테스트 결과, 개선 기록 |
| [reports/](reports/) | 기존 AI/RAG 설계·품질·아키텍처 분석 보고서 |
| [assets/](assets/) | 보고서와 문서에서 사용하는 이미지/SVG 자료 |
| [final/](final/) | 평가 제출용 최종 산출물 후보와 발표/체크리스트 |

## 최종 평가 산출물

| 산출물 | 문서 |
|---|---|
| 테스트 계획 및 결과 보고서 | [final/TEST_PLAN_AND_RESULT_REPORT.md](final/TEST_PLAN_AND_RESULT_REPORT.md) |
| 요구사항 정의서 | [final/REQUIREMENTS_SPECIFICATION_FINAL.md](final/REQUIREMENTS_SPECIFICATION_FINAL.md) |
| 화면설계서 | [final/SCREEN_DESIGN_FINAL.md](final/SCREEN_DESIGN_FINAL.md) |
| 시스템 구성도 | [final/SYSTEM_ARCHITECTURE_FINAL.md](final/SYSTEM_ARCHITECTURE_FINAL.md) |
| 10분 발표자료 가이드 | [final/PRESENTATION_GUIDE_10MIN.md](final/PRESENTATION_GUIDE_10MIN.md) |
| 최종 산출물 체크리스트 | [final/FINAL_DELIVERABLE_CHECKLIST.md](final/FINAL_DELIVERABLE_CHECKLIST.md) |

## 기준 문서

| 확인하려는 내용 | 문서 |
|---|---|
| 현재 통합 브랜치 구조와 전달 메모 | [current/260706_VERSION1_INTEGRATION_HANDOFF.md](current/260706_VERSION1_INTEGRATION_HANDOFF.md) |
| 2026-07-06 기준 FastAPI 응답 계약 | [current/260706_VERSION1_API_RESPONSE_CONTRACT.md](current/260706_VERSION1_API_RESPONSE_CONTRACT.md) |
| `version-1` 통합 브랜치의 현재 구조와 정상화 요약 | [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md) |
| PDF 분석 개선 현황, 필드, 검증 결과 | [current/260707_VERSION1_PDF_ANALYSIS_STATUS.md](current/260707_VERSION1_PDF_ANALYSIS_STATUS.md) |

## 실행·협업 가이드

| 확인하려는 내용 | 문서 |
|---|---|
| 역할, 작업 순서, Git·PR·QA 규칙 | [guides/TEAM_GUIDE.md](guides/TEAM_GUIDE.md) |
| 현재 브랜치 실행과 검증 명령 | [../README.md](../README.md) |

## 작업 기록

| 확인하려는 내용 | 문서 |
|---|---|
| 통합·정리 작업 이력 | [traces/CHANGELOG.md](traces/CHANGELOG.md) |
| 문제 원인과 수정 근거 중심 기록 | [traces/fix-log.md](traces/fix-log.md) |
| PDF 개선 판단 과정과 작업 추적 | [traces/260707_PDF_IMPROVEMENT_TRACKING.md](traces/260707_PDF_IMPROVEMENT_TRACKING.md) |
| 2026-07-03 전체 현황 스냅샷 | [traces/260703_CURRENT_STATUS.md](traces/260703_CURRENT_STATUS.md) |
| 2026-07-03 MVP 명세 스냅샷 | [traces/260703_PROJECT_SPEC.md](traces/260703_PROJECT_SPEC.md) |
| 2026-07-03 API 계약 스냅샷 | [traces/260703_API_CONTRACT.md](traces/260703_API_CONTRACT.md) |

## 프론트 문서

| 확인하려는 내용 | 문서 |
|---|---|
| 화면설계서 | [frontend/SCREEN_DESIGN.md](frontend/SCREEN_DESIGN.md) |
| 요구사항 추적표 | [frontend/REQUIREMENTS_TRACEABILITY.md](frontend/REQUIREMENTS_TRACEABILITY.md) |
| 테스트 결과 보고서 | [frontend/260706_TEST_REPORT.md](frontend/260706_TEST_REPORT.md) |
| 수정·개선 기록 | [frontend/260706_FRONTEND_CHANGELOG.md](frontend/260706_FRONTEND_CHANGELOG.md) |

## 문서 관리 원칙

- 새로 합류한 팀원에게는 먼저 `docs/README.md`와 [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md)를 안내합니다.
- 공개 API 변경은 코드와 [current/260706_VERSION1_API_RESPONSE_CONTRACT.md](current/260706_VERSION1_API_RESPONSE_CONTRACT.md)를 함께 수정합니다.
- 제품 범위나 아키텍처 결정은 [current/VERSION1_CURRENT_ARCHITECTURE.md](current/VERSION1_CURRENT_ARCHITECTURE.md)에 반영합니다.
- 완료된 작업의 핵심 결과는 [traces/CHANGELOG.md](traces/CHANGELOG.md)에 기록합니다.
- 세부 판단 과정은 `traces/`에 남기되, 현재 기준 문서와 섞지 않습니다.
- 분석 보고서는 과거 설계 근거이므로 현재 운영 명세와 구분해서 사용합니다.
