# version-1 정상화 변경 추적

기준 브랜치: `origin/version-1`  
작업 브랜치: `version-1-normalize`  
목적: `version-1`을 주말 공동 개발 기준으로 사용할 수 있도록 실행 오류, merge 깨짐, 테스트 불일치, 문서 부족을 정리한다.

## 1. 시작 시점 문제

| 구분 | 문제 | 영향 |
|---|---|---|
| React | `Layout.tsx` React hook/router import 누락 | 빌드 실패 가능 |
| React | `StrategyRun.tsx` icon import 누락 | 빌드 실패 |
| React | `StrategyRun.tsx` checkbox JSX 구조 깨짐 | 빌드 실패 |
| React | PDF 기능이 구현됐지만 메뉴에는 `PDF 분석 · 준비 중`으로 남음 | 사용자/팀원 혼동 |
| Django | DummyLoginMiddleware 제거 후 테스트가 기존 dummy login 전제를 유지 | 테스트 실패 |
| Django | PDF 분석 구현 후에도 테스트가 `PDF_ANALYSIS_UNSUPPORTED`를 기대 | 테스트 실패 |
| 문서 | `version-1` 현재 구조와 정상화 이유를 설명하는 기준 문서 부재 | PM/팀원 공유 어려움 |

## 2. 변경 기록

### 2.1 React merge 오류 복구

변경 파일:

- `frontend-react/src/app/components/Layout.tsx`
- `frontend-react/src/app/pages/StrategyRun.tsx`

바뀐 이유:

- `version-1` 병합 중 import와 JSX 일부가 깨져 프론트 빌드가 실패할 수 있었다.
- PDF 분석 기능이 실제 구현됐으므로 화면에서도 명확한 진입 경로가 필요했다.

어떻게 바뀌었는가:

- `Layout.tsx`에 `useEffect`, `useState`, `useNavigate` import를 복구했다.
- sidebar에 `/pdf`로 이동하는 `PDF 분석` 메뉴를 추가했다.
- `StrategyRun.tsx`에 누락된 lucide icon import를 추가했다.
- checkbox label/input 구조를 정상 JSX로 복구했다.
- 전략 진단 화면에 `PDF 파일로 분석하기` 버튼을 복구했다.

### 2.2 Django 테스트 최신화

변경 파일:

- `django_backend/accounts/tests.py`
- `django_backend/strategy/tests.py`

바뀐 이유:

- `version-1`은 더미 로그인 대신 실제 인증 흐름을 사용한다.
- PDF 분석은 더 이상 미지원 기능이 아니라 실제 Django → FastAPI proxy 흐름으로 동작한다.

어떻게 바뀌었는가:

- 프로필 테스트에서 명시적으로 테스트 사용자를 만들고 `force_authenticate()`로 인증 상태를 구성했다.
- “비로그인 dummy user 404” 테스트를 “인증 사용자 프로필 없음 404” 테스트로 바꿨다.
- PDF 테스트는 FastAPI proxy를 mock하고 정상 PDF 분석 응답이 200으로 반환되는지 검증하게 바꿨다.

검증 결과:

```text
python django_backend\manage.py test accounts strategy
Found 25 test(s).
Ran 25 tests successfully
OK
```

### 2.3 version-1 구조 문서 추가

변경 파일:

- `docs/current/VERSION1_CURRENT_ARCHITECTURE.md`
- `docs/README.md`

바뀐 이유:

- `version-1`은 여러 사람 작업이 합쳐진 브랜치라, 파일만 보고는 현재 구조와 변경 이유를 파악하기 어렵다.
- PM과 팀원이 브랜치 상태를 공유받을 때 “무엇이 바뀌었고 어떤 흐름으로 동작하는지”를 한 번에 볼 기준 문서가 필요했다.

어떻게 바뀌었는가:

- `VERSION1_CURRENT_ARCHITECTURE.md`에 변경 요약, 서비스 구조, API 흐름, 주요 파일 구조, 실행 체크포인트, 남은 과제를 정리했다.
- `docs/README.md`에서 해당 문서를 바로 찾을 수 있게 링크를 추가했다.

### 2.4 ChromaDB 구축 점검 보강

변경 파일:

- `Backend/src/preprocessing/build_all.py`
- `scripts/dev-doctor.ps1`
- `docs/current/VERSION1_CURRENT_ARCHITECTURE.md`

바뀐 이유:

- ChromaDB는 Git에 올리지 않는 로컬 산출물이므로, `version-1` 브랜치를 받는 팀원은 직접 재구축해야 한다.
- 기존 `dev-doctor.ps1`은 `chroma.sqlite3` 파일 존재만 확인해 collection이 실제로 만들어졌는지 알 수 없었다.
- `build_all.py` 설명의 `data/` 경로가 팀원에게 루트 `data/`처럼 보일 수 있어 `Backend/data` 기준임을 명확히 할 필요가 있었다.

어떻게 바뀌었는가:

- `build_all.py` 주석을 `Backend/data` 원본 문서 기준으로 정리했다.
- `build_all.py`의 `main()`에 `.env`/`OPENAI_API_KEY` 필요성을 설명하는 docstring을 추가했다.
- `dev-doctor.ps1`이 ChromaDB collection count를 읽어 6개 collection 여부를 확인하도록 보강했다.
- `VERSION1_CURRENT_ARCHITECTURE.md`에 ChromaDB 재구축 명령과 기대 collection 목록을 추가했다.

검증:

- `Backend/data` 원본 문서 존재 확인.
- `version-1_check`의 ChromaDB collection은 빌드 전 `[]` 상태임을 확인.
- 실제 `build_all.py` 실행은 OpenAI embedding API 호출이 필요하나, Codex 환경의 네트워크 실행이 사용량 제한으로 승인되지 않아 완료하지 못했다.
- 따라서 ChromaDB는 팀원이 로컬에서 아래 명령으로 재구축 후 count 확인해야 한다.

```cmd
python -X utf8 Backend\src\preprocessing\build_all.py
python -c "import chromadb; c=chromadb.PersistentClient(path='Backend/src/preprocessing/chroma_db'); print(sorted([(x.name, x.count()) for x in c.list_collections()]))"
```

기대 collection은 `faq_chunks`, `guide_chunks`, `law_chunks`, `lh_guide_chunks`, `manual_chunks`, `web_faq_chunks` 총 6개다.

## 3. 검증 상태

완료:

- Django `manage.py check`
- Django `accounts`, `strategy` 테스트 25개 통과
- FastAPI app import 확인
- React `pnpm install` 통과
- React `pnpm run build` 통과
- ChromaDB 원본 데이터와 build script 경로 확인
- ChromaDB collection count 확인 로직 추가

React 검증 환경:

- Node `v22.23.1`
- npm `10.9.8`
- pnpm `11.9.0`

ChromaDB 상태:

- DB 파일 자체는 Git에 포함하지 않는다.
- `version-1_check`에서는 재구축 전 collection이 비어 있었다.
- OpenAI embedding API 호출 제한 때문에 Codex가 직접 재구축을 완료하지 못했다.
- 팀원은 `build_all.py` 실행 후 6개 collection count를 반드시 확인해야 한다.

## 4. 남은 주의사항

- `version-1`의 React build는 통과했지만, 실제 브라우저 화면 QA는 3개 서버를 켠 상태에서 추가 확인하는 것이 좋다.
- PDF 추출 결과가 최종 리포트에 충분히 드러나는지는 다음 고도화 과제로 남아 있다.
- FastAPI 응답 구조를 더 정리하면 Django serializer와 React 결과 화면도 함께 조정해야 한다.
