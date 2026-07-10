# 프로젝트 문서 색인

이 디렉터리는 최종 제출과 운영 재현에 필요한 문서만 유지합니다.

## 최종 산출물

| 산출물 | 문서 |
|---|---|
| 최종 산출물 체크리스트 | [final_v2/FINAL_DELIVERABLE_CHECKLIST.md](final_v2/FINAL_DELIVERABLE_CHECKLIST.md) |
| 요구사항 정의서 | [final_v2/REQUIREMENTS_SPECIFICATION_FINAL.md](final_v2/REQUIREMENTS_SPECIFICATION_FINAL.md) |
| 화면설계서 | [final_v2/SCREEN_DESIGN_FINAL.md](final_v2/SCREEN_DESIGN_FINAL.md) |
| 시스템 구성도 | [final_v2/SYSTEM_ARCHITECTURE_FINAL.md](final_v2/SYSTEM_ARCHITECTURE_FINAL.md) |
| 테스트 계획 및 결과 보고서 | [final_v2/TEST_PLAN_AND_RESULT_REPORT.md](final_v2/TEST_PLAN_AND_RESULT_REPORT.md) |
| Docker/AWS/CI-CD 배포 정리 | [final_v2/DEPLOYMENT_CICD_FINAL.md](final_v2/DEPLOYMENT_CICD_FINAL.md) |
| 최종 발표자료 PDF | [final_v2/AFIT.pdf](final_v2/AFIT.pdf) |
| 10분 발표자료 가이드 | [final_v2/PRESENTATION_GUIDE_10MIN.md](final_v2/PRESENTATION_GUIDE_10MIN.md) |

## 운영 가이드

| 목적 | 문서 |
|---|---|
| GitHub Actions CI/CD secret 및 실행 흐름 | [guides/GITHUB_ACTIONS_CICD_SETUP.md](guides/GITHUB_ACTIONS_CICD_SETUP.md) |
| 로컬 실행, Docker Compose, 검증 명령 | [../README.md](../README.md) |

## 정리 기준

- `docs/final_v2/`은 제출용 최종 문서입니다.
- `docs/guides/`는 최종 운영에 필요한 절차 문서만 유지합니다.
- 중간 개발 기록, 과거 보고서, fixture 예시는 최종 브랜치에서 제거했습니다.
- CI/CD는 GitHub Actions 기반 검증, 이미지 빌드/푸시, EC2 배포 흐름을 구현 완료 기준으로 문서화합니다.
