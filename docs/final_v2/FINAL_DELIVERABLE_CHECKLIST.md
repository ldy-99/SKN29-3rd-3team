# 최종 평가 산출물 체크리스트 (v2)

| 산출물 | 파일 | 상태 | 비고 |
|---|---|---|---|
| 요구사항 정의서 | `docs/final_v2/REQUIREMENTS_SPECIFICATION_FINAL.md` | 작성 완료 | 최신 마이페이지/계정/PDF/배포 상태 반영 |
| 화면설계서 | `docs/final_v2/SCREEN_DESIGN_FINAL.md` | 작성 완료 | URL, 목적, 권한, API, 상태 포함 |
| 개발된 LLM 연동 웹 애플리케이션 | 코드/실행 화면 | 구현 및 배포 완료 | EC2 Gunicorn 배포 및 외부 도메인 접속 연동 완료 |
| 시스템 구성도 | `docs/final_v2/SYSTEM_ARCHITECTURE_FINAL.md` | 작성 완료 | React-Django-FastAPI-Docker(80포트 Nginx) 흐름 정리 |
| 테스트 계획 및 결과 보고서 | `docs/final_v2/TEST_PLAN_AND_RESULT_REPORT.md` | 작성 완료 | Gunicorn 전환 및 실서버 배포 이슈 해결 이력 완비 |
| 발표자료 가이드 | `docs/final_v2/PRESENTATION_GUIDE_10MIN.md` | 작성 완료 | 10분 발표 핵심 흐름 조율 |

## ## 실제 확인한 구현 및 배포 상태

- `진단 기록` 탭은 `마이페이지`로 성공적으로 변경 및 통합 완료
- 마이페이지 내 이메일, 가입일, 진단 횟수 등 계정 정보 카드 정상 표시
- 비밀번호 변경 API 및 모달 UI 연동 완료
- 비밀번호 검증 기반 안전한 계정 삭제(탈퇴) 기능 구현 및 자동 테스트 통과
- 마이페이지 내 레이아웃 정리 (기본 정보 진단을 계정 카드 아래로 재배치)
- 마이페이지 새로고침 불필요 버튼 제거를 통해 UX 간소화
- 결과 상세 화면 내 `내 프로필` Floating 버튼 및 스냅샷 모달 적용 완료
- `다시 진단하기` 동작 시 프로필 화면 최상단 스크롤 조치 완료
- 챗봇 패널을 Floating 버튼 형태로 개편하여 화면 가독성 대폭 향상
- PDF 파일 업로드 크기 Nginx edge limit 20MB 설정 완료 (Django 15MB 제한과 일관성 유지)
- **로컬 Docker 이미지 빌드 및 허브 푸시(Push) 완료**
- **EC2 실서버에서 최신 이미지 풀(Pull) 및 컨테이너 가동(`docker compose up -d`) 완료**
- **Nginx 포트 80(HTTP)을 통한 대표 도메인(`http://a-fit.duckdns.org`) 접속 및 로그인 완료**
- **Django 백엔드 엔진의 Gunicorn WAS 가동 및 Whitenoise 정적 파일 서빙 성공**
- **SQLite DB의 Named 볼륨 마운트를 통한 컨테이너 재부팅 시 데이터 보존 완료**
- **로그인 시 CSRF 토큰(쿠키-헤더 이중 제출 패턴) 연동 해결 완료**

## ## 제출 전 체크리스트

- [o] 로컬 소스 코드 빌드 및 Docker Hub 업로드 완료
- [o] EC2 배포 서버 최신 이미지 다운로드 및 가동 (`docker compose pull && docker compose up -d`)
- [o] 외부 도메인 주소(`a-fit.duckdns.org`)로 포트 번호 없이 정상 접속되는지 브라우저에서 최종 확인
- [o] 테스트 계정을 활용하여 회원가입 ➡️ 로그인 ➡️ 프로필 저장 ➡️ 기본 진단 ➡️ 결과 상세 ➡️ 마이페이지 이력 확인 ➡️ Floating 챗봇 질의 리허설 수행
- [o] `git push origin pdf-improvement-0707` (혹은 지정된 브랜치로 최종 push 수행)
- [o] GitHub PR 생성 또는 최신 merge 상태 점검
- [x] 발표자료(PPT)에 실제 사용하지 않는 기술(RDS, S3, HTTPS 등)을 완료된 것처럼 표기하지 않았는지 검증
