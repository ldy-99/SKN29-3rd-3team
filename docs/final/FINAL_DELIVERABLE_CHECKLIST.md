# 최종 평가 산출물 체크리스트

| 산출물 | 파일 | 상태 | 비고 |
|---|---|---|---|
| 요구사항 정의서 | `docs/final/REQUIREMENTS_SPECIFICATION_FINAL.md` | 작성 완료 | 최신 마이페이지/계정/PDF/배포 상태 반영 |
| 화면설계서 | `docs/final/SCREEN_DESIGN_FINAL.md` | 작성 완료 | URL, 목적, 권한, API, 상태 포함 |
| 개발된 LLM 연동 웹 애플리케이션 | 코드/실행 화면 | 구현 완료 후보 | EC2 최신 배포 반영 확인 필요 |
| 시스템 구성도 | `docs/final/SYSTEM_ARCHITECTURE_FINAL.md` | 작성 완료 | React-Django-FastAPI-Docker 흐름 정리 |
| 테스트 계획 및 결과 보고서 | `docs/final/TEST_PLAN_AND_RESULT_REPORT.md` | 작성 완료 | 가장 중요한 평가 항목 보강 |
| 발표자료 가이드 | `docs/final/PRESENTATION_GUIDE_10MIN.md` | 작성 완료 | 10분 발표 흐름 |

## 평가 기준별 보강 내용

| 평가 항목 | 보강 내용 | 남은 확인 |
|---|---|---|
| 요구사항 정의서 | 기능/비기능/LLM/API/추적성 최신화 | final merge 후 최종 경로 확인 |
| 화면설계서 | 반응형, 인증, LLM 로딩/오류, 마이페이지 UX 반영 | 실제 캡처 첨부 여부 |
| 웹 애플리케이션 | 마이페이지, 계정 관리, 결과 상세, 챗봇 UX 개선 | EC2 최신 배포 |
| 시스템 구성도 | Nginx-Django-FastAPI, Docker, SQLite, OpenAI 흐름 명시 | EC2 포트 매핑 최종 확인 |
| 테스트 보고서 | PASS/PARTIAL/NOT_TESTED 분리, 이슈/수정/재검증 정리 | Docker 실배포 테스트 |

## 실제 확인한 구현 상태

- `진단 기록` 탭은 `마이페이지`로 변경됨
- 마이페이지 계정 정보 카드 표시
- 비밀번호 변경 API/UI 추가
- 비밀번호 확인 및 최종 확인 모달 기반 계정 삭제
- 기본 정보 진단이 계정 카드 아래로 이동
- 마이페이지 새로고침 버튼 제거
- 공고 기반 분석 카드/이력 모달 유지
- 결과 상세 `내 프로필` Floating UI 추가
- `다시 진단하기` 이동 시 최상단 스크롤 확인
- 챗봇 Floating 버튼/패널 적용
- PDF 업로드 Nginx edge limit 20MB 설정
- ESLint/TypeScript/build/test 검증 통과

## 확인하지 못해 TODO로 남긴 항목

| 항목 | 상태 | 확인 방법 |
|---|---|---|
| GitHub push | BLOCKED | Codex 네트워크 실행 차단. 사용자 직접 `git push origin pdf-improvement-0707` 필요 |
| EC2 최신 배포 | NOT_TESTED | `docker compose pull && docker compose up -d` |
| Docker 이미지 빌드 | NOT_TESTED | `docker-compose build` |
| Docker Hub push/pull | NOT_TESTED | `docker-compose push`, EC2 `docker compose pull` |
| 외부 URL 접속 | NOT_TESTED | `http://a-fit.duckdns.org/` 접속 |
| 공고문 직접 입력 최신 회귀 | NOT_TESTED | 샘플 텍스트로 `/strategy` 실행 |
| PDF 다건 품질 회귀 | PARTIAL | `sample_pdfs` 다건 비교 |
| 챗봇 실제 RAG 답변/출처 | NOT_TESTED | ChromaDB/OpenAI 준비 후 질의 |

## 제출 전 사람이 직접 확인할 체크리스트

1. `git push origin pdf-improvement-0707`
2. GitHub PR 생성 또는 기존 PR 업데이트 확인
3. final 브랜치 최신 merge 여부 확인
4. EC2 배포 환경에서 최신 이미지 pull
5. 컨테이너 상태 확인
6. 외부 URL 접속 확인
7. 회원가입/로그인/기본 진단/마이페이지/챗봇 시연 리허설
8. 발표자료에 RDS/S3/HTTPS/CI/CD를 완료처럼 쓰지 않았는지 점검

