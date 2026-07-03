# 팀 작업 가이드

## 1. 역할과 책임

| 역할 | 주 책임 | 완료 기준 |
|---|---|---|
| A — PM·React | 사용자 흐름, Result·로딩·오류·챗봇 UI | 확정 API 계약으로 전체 플로우가 표시됨 |
| B — Tech Lead·Integration | API 계약, PDF 범위, 통합 Gate, PR·배포 기준 | 계약 충돌이 없고 통합 QA 가능 |
| C — Django API | session 인증, 모델, adapter, 상태 저장, 환경설정 | 공개 API와 FastAPI proxy가 안정적으로 동작 |
| D — FastAPI·RAG | LangGraph/RAG, timeout·fallback, 초기화 분리 | 내부 API가 예측 가능한 시간과 오류로 응답 |

역할은 파일 독점권이 아니라 최종 판단 책임입니다. 다른 영역을 수정할 때는 해당 책임자의 리뷰를 받습니다.

## 2. 권장 작업 순서

1. B가 Result 응답 계약과 PDF 범위를 확정합니다.
2. C가 Django 응답 adapter, 실행 상태, 환경설정을 정리합니다.
3. D가 LLM timeout·fallback과 import 시 초기화를 분리합니다.
4. A가 확정 계약으로 Result, 로딩, 오류 UI를 완성합니다.
5. 전원이 새 clone에서 회원가입부터 챗봇까지 통합 QA합니다.
6. Docker·배포 문서와 CI를 정리합니다.

계약이 확정되기 전에 각 화면과 서버가 서로 다른 응답 예시를 기준으로 개발하지 않습니다.

## 3. 역할별 다음 작업

### A — PM·React

- 전략 진단 30~40초 대기 상태와 경과시간 표시
- 중복 실행과 실행 중 화면 이동 방지
- 90초 backend timeout, 95초 frontend abort, 502 메시지 구분
- 실제 FastAPI result를 기준으로 Result component 정리
- 챗봇 긴 답변, 문단, 번호 목록, 출처 toggle 가독성 검증
- PDF 추출 결과를 사용자가 확인하고 전략 진단 입력으로 넘기는 흐름 검증

### B — Tech Lead·Integration

- `API_CONTRACT.md`와 fixture를 단일 계약으로 관리
- PDF 원본 미저장, 추출 텍스트 저장 범위, 구조화 고도화 범위 관리
- Result payload를 `result_payload` 내부 또는 최상위 중 하나로 확정
- 새 clone QA 시나리오와 통과 기준 관리
- 변경 충돌, migration, 환경변수, rollback 영향 리뷰

### C — Django API

- 공개 오류 코드와 HTTP status 일치
- FastAPI 응답 adapter 단일화
- `PENDING → RUNNING → SUCCEEDED/FAILED` 상태 정합성
- timeout과 FastAPI URL 환경변수 적용
- 표준 CSRF token 방식 전환
- SQLite에서 배포 DB로 전환할 경우 migration 절차 작성

### D — FastAPI·RAG

- 앱 import 시 LLM·embedding 객체 생성 지연 또는 분리
- 외부 LLM 호출별 timeout과 fallback 정의
- `/api/profile`, `/api/simulate`, `/api/announcement`, `/api/chat` 계약 고정
- `/api/pdf/analyze` 추출 품질, 오류, 파일 크기 제한 회귀 테스트
- RAG 답변의 answer, sources, session_id 구조 안정화
- Node 6 장시간 정지와 예외 경로 회귀 테스트

## 4. Git 작업 규칙

새 환경 실행 검증은 `final-debug-share` 브랜치에서 먼저 맞춥니다. 검증이 끝난 뒤 일반 개발 브랜치는 팀 합의에 따라 `final` 또는 합의된 기준 브랜치에서 분기합니다.

```powershell
git switch final-debug-share
git pull --ff-only origin final-debug-share
git switch -c <type>/<short-description>
```

브랜치 type:

```text
feat/ | fix/ | docs/ | chore/ | test/
```

원칙:

- 한 브랜치는 한 목적만 다룹니다.
- API 계약, migration, 환경변수 변경을 PR 본문에 명시합니다.
- unrelated formatting과 개인 DB·로그를 커밋하지 않습니다.
- 직접 `final` 작업은 팀이 명시적으로 합의한 통합·문서 정리에만 사용합니다.
- 강제 push와 `git reset --hard`는 사용하지 않습니다.

## 5. PR 확인 항목

```text
목적
관련 이슈
변경 내용
테스트 결과
API·DB·환경변수 변경
영향 범위
UI 캡처 또는 해당 없음
배포·rollback 영향
```

리뷰 기준:

- A: 화면 흐름과 사용자 메시지
- B: 계약, 통합 영향, 배포 가능성
- C: Django API, DB, 인증, 권한
- D: AI 계산, RAG, LLM 호출

## 6. 자동 검증

```powershell
# Django
Push-Location django_backend
..\.venv\Scripts\python.exe manage.py test
Pop-Location

# React
Push-Location frontend-react
pnpm.cmd run build
Pop-Location

# FastAPI import
.\.venv\Scripts\python.exe -c "import sys; sys.path.insert(0, 'Backend'); from main import app; print(app.title)"
```

## 7. 통합 QA

새 clone과 신규 사용자 기준으로 확인합니다.

1. 회원가입 후 자동 로그인
2. 프로필이 없을 때 빈 작성 화면
3. 프로필 저장·재조회
4. 기본 프로필 진단
5. 수동 공고문 진단
6. 결과 목록·상세 조회
7. 챗봇 질문·후속 질문·출처 toggle
8. 중복 클릭 방지와 timeout·502 오류

각 단계에서 브라우저 Network, Django 로그, FastAPI 로그를 함께 확인합니다.

## 8. 완료 Gate

- `API_CONTRACT.md`와 실제 응답이 일치합니다.
- Django 테스트와 React build가 통과합니다.
- FastAPI import와 `/health`가 정상입니다.
- 신규 사용자 전체 플로우가 한 번 이상 통과합니다.
- 미완료 PDF 경로가 정상 기능처럼 노출되지 않습니다.
- 새 환경에서 필요한 비밀값과 실행 순서가 `LOCAL_SETUP.md`에 있습니다.
