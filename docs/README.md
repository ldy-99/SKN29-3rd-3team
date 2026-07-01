# 프로젝트 문서

문서는 용도별로 한 곳만 기준 문서로 사용합니다.

| 확인하려는 내용 | 기준 문서 |
|---|---|
| MVP 범위, 구조, 현재 상태 | [PROJECT_SPEC.md](PROJECT_SPEC.md) |
| API 경로, 요청·응답, 필드 | [API_CONTRACT.md](API_CONTRACT.md) |
| 설치, 환경변수, 3개 서버 실행, 오류 대응 | [LOCAL_SETUP.md](LOCAL_SETUP.md) |
| 역할, 작업 순서, Git·PR·QA 규칙 | [TEAM_GUIDE.md](TEAM_GUIDE.md) |
| 통합·정리 작업 이력 | [CHANGELOG.md](CHANGELOG.md) |
| 기존 AI/RAG 설계 근거 | [reports/](reports/) |

## 문서 관리 원칙

- 실행 명령과 환경변수는 `LOCAL_SETUP.md`에서만 상세 관리합니다.
- 공개 API 변경은 코드, `API_CONTRACT.md`, `fixture_examples/`를 함께 수정합니다.
- 제품 범위나 아키텍처 결정은 `PROJECT_SPEC.md`에 반영합니다.
- 완료된 작업의 핵심 결과만 `CHANGELOG.md`에 기록합니다.
- 개인별 작업 메모, 날짜별 walkthrough, 동일 내용의 복사본은 추가하지 않습니다.
- 분석 보고서는 과거 설계 근거이므로 현재 운영 명세와 구분해서 사용합니다.
