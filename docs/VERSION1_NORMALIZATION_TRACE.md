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
Ran 25 tests in 4.346s
OK
```

### 2.3 version-1 구조 문서 추가

변경 파일:

- `docs/VERSION1_CURRENT_ARCHITECTURE.md`
- `docs/README.md`

바뀐 이유:

- `version-1`은 여러 사람 작업이 합쳐진 브랜치라, 파일만 보고는 현재 구조와 변경 이유를 파악하기 어렵다.
- PM과 팀원이 브랜치 상태를 공유받을 때 “무엇이 바뀌었고 어떤 흐름으로 동작하는지”를 한 번에 볼 기준 문서가 필요했다.

어떻게 바뀌었는가:

- `VERSION1_CURRENT_ARCHITECTURE.md`에 변경 요약, 서비스 구조, API 흐름, 주요 파일 구조, 실행 체크포인트, 남은 과제를 정리했다.
- `docs/README.md`에서 해당 문서를 바로 찾을 수 있게 링크를 추가했다.

## 3. 검증 상태

완료:

- Django `manage.py check`
- Django `accounts`, `strategy` 테스트 25개 통과
- FastAPI app import 확인

보류:

- React build는 현재 Codex PowerShell worktree에 `node_modules`가 없고 PATH의 Node가 `v16.20.2`라 완료하지 못했다.
- React는 Node 20 이상 환경에서 `pnpm install` 후 `pnpm run build` 또는 `pnpm run dev`로 재검증해야 한다.

## 4. 남은 주의사항

- `version-1`의 React UI는 정상화했지만, 실제 화면 QA는 Node 20 이상 환경에서 필요하다.
- PDF 추출 결과가 최종 리포트에 충분히 드러나는지는 다음 고도화 과제로 남아 있다.
- FastAPI 응답 구조를 더 정리하면 Django serializer와 React 결과 화면도 함께 조정해야 한다.

