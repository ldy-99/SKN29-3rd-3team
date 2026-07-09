# final v2 산출물 색인

이 폴더는 SKN 29기 AI 활용 애플리케이션 개발 단위 프로젝트 평가 제출용 최종 산출물(v2)을 모은다. 

로컬에서의 Docker 빌드/푸시 및 EC2 환경에서의 Gunicorn 서버 배포, 포트 80 단일화, Nginx 프록시 연동, 세션/CSRF 보안 처리가 실제로 완료되고 검증된 상태를 반영하여 업데이트되었습니다.

| 순서 | 산출물 | 파일 |
|---|---|---|
| 1 | 테스트 계획 및 결과 보고서 | [TEST_PLAN_AND_RESULT_REPORT.md](TEST_PLAN_AND_RESULT_REPORT.md) |
| 2 | 요구사항 정의서 | [REQUIREMENTS_SPECIFICATION_FINAL.md](REQUIREMENTS_SPECIFICATION_FINAL.md) |
| 3 | 화면설계서 | [SCREEN_DESIGN_FINAL.md](SCREEN_DESIGN_FINAL.md) |
| 4 | 시스템 구성도 | [SYSTEM_ARCHITECTURE_FINAL.md](SYSTEM_ARCHITECTURE_FINAL.md) |
| 5 | 10분 발표자료 가이드 | [PRESENTATION_GUIDE_10MIN.md](PRESENTATION_GUIDE_10MIN.md) |
| 6 | 최종 산출물 체크리스트 | [FINAL_DELIVERABLE_CHECKLIST.md](FINAL_DELIVERABLE_CHECKLIST.md) |

## 사용 원칙

- 실제 확인 및 검증이 완료된 도커 빌드/푸시/풀, Gunicorn 배포, 외부 URL 접속 기능은 `완료` 또는 `PASS`로 적는다.
- RDS, S3, HTTPS, CI/CD는 현재 완료 기능으로 쓰지 않고 후속 과제로 분리한다.
- 발표자료는 이 폴더의 문서를 요약해 10분 안에 설명한다.
