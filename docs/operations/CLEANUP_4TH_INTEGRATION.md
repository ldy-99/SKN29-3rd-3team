# 4차 통합 파일 정리 내역

## 1. 목적

4차 프로젝트의 실제 실행 구조를 React → Django → FastAPI/RAG로 단일화하고, 새 clone에서 필요한 환경과 실행 절차를 명확하게 만드는 작업입니다.

## 2. 제거 항목

### 기존 Streamlit `frontend/`

3차 프로젝트의 화면 구현 전체를 제거했습니다.

- Streamlit entrypoint와 pages
- Streamlit UI component와 view
- Streamlit용 API client, mock, payload 변환
- Streamlit session state와 화면 상수

제거 근거:

- 4차 사용자 화면은 `frontend-react/`로 대체됐습니다.
- 두 UI를 함께 유지하면 실행 안내와 API 연결 기준이 서로 충돌합니다.
- 루트 requirements에서 Streamlit을 제거해 Python 설치 범위를 AI/API 서버로 제한할 수 있습니다.

## 3. 유지 항목

| 항목 | 유지 근거 |
|---|---|
| `django_backend/db.sqlite3` | 팀 합의에 따라 현재 데이터와 실행 상태 유지 |
| `backend/` | FastAPI와 기존 LangGraph/RAG 핵심 구현 |
| `backend/data/` | RAG 원천 문서 및 구조화 계산 데이터 |
| `backend/src/preprocessing/chroma_db/` | 로컬 RAG 검색에 필요한 생성 데이터 |
| `backend/src/engine/` | 자격·가점·재무 계산과 전략 파이프라인 |
| `fixture_examples/` | 공개 API 계약 예시와 오류 fixture |
| `docs/reports/` | 기존 RAG·성능·아키텍처 분석 산출물 |

## 4. 환경·의존성 변경

- 루트 `requirements.txt`를 FastAPI/RAG 전용으로 정리하고 검증 환경 버전을 고정했습니다.
- `django_backend/requirements.txt`를 Django 전용으로 분리하고 버전을 고정했습니다.
- 사용하지 않는 `streamlit`, 중복 검색 패키지 `duckduckgo-search`를 제거했습니다.
- `.env.example`과 `frontend-react/.env.example`을 추가했습니다.
- Django가 루트 `.env`의 보안값, origin, FastAPI URL과 timeout을 실제로 읽도록 변경했습니다.
- `.gitignore`에 비밀값, 로그, build, cache 규칙을 정리했습니다.

## 5. 실행 구조

```text
frontend-react/
  → django_backend/
      → backend/
          → LangGraph / calculator / RAG / ChromaDB / OpenAI
```

포트 기준:

- React: `5173`
- Django: `8000`
- FastAPI: `8080`

## 6. 알려진 제한

- PDF 화면과 Django `/api/pdf/analyze` 프록시는 존재합니다.
- FastAPI `/api/pdf/analyze` endpoint는 아직 없어 PDF 기반 통합 진단은 완료되지 않았습니다.
- MVP에서는 수동 모집공고문 입력을 정상 fallback으로 사용합니다.

## 7. 검증 기록

2026-07-02에 기존 환경과 분리된 임시 Python 3.10 가상환경을 생성해 두 requirements를 처음부터 설치한 뒤 검증했습니다. 검증 후 임시 환경은 삭제했습니다.

| 검증 | 명령 | 결과 |
|---|---|---|
| Clean install | `pip install -r requirements.txt -r django_backend/requirements.txt` | 설치 성공, dependency conflict 없음 |
| Django system check | `cd django_backend; python manage.py check` | 오류 없음 |
| Django test | `cd django_backend; python manage.py test` | 22개 전체 통과 |
| FastAPI import | `python -c "... from main import app ..."` | 앱과 5개 `/api` router 및 `/health` import 성공 |
| Python dependency import | 핵심 AI/Django 패키지 import | 성공 |
| React build | `pnpm.cmd run build` | Vite production build 성공 |
| Streamlit 참조 점검 | `rg -i "streamlit" README.md requirements.txt django_backend frontend-react` | 정리 설명 외 실행 코드·requirements 참조 없음 |
