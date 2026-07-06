# 브랜치 병합 기록

## 2026-07-06 — `jihun` → `version-1`

- 대상 브랜치: `version-1`
- 원본 브랜치: `origin/jihun`
- 원본 커밋: `bf0c5ff` (`backend 수정`)
- 병합 커밋: `4019b00` (`Merge branch 'jihun' into version-1`)
- 충돌: 없음

### 주요 반영 내용

- LLM 안전 처리 모듈 추가 및 파이프라인 노드의 오류·fallback 처리 강화
- 파이프라인과 채팅 체크포인트를 프로세스 메모리 대신 SQLite에 저장
- ChromaDB 또는 API 키 문제로 FastAPI 전체가 시작되지 않는 상황을 막기 위해 채팅 그래프를 지연 초기화
- RAG 도구, 채팅 router/service, 파이프라인 재개 및 오류 응답 처리 보완
- 실제 FastAPI 응답 구조에 맞게 Django serializer와 React 결과 상세 필드 정리
- 관련 의존성과 `.gitignore` 갱신

### 변경 범위

- 16개 파일 변경
- 962줄 추가, 108줄 삭제
- 주요 경로: `Backend/app`, `Backend/src`, `django_backend/strategy`, `frontend-react`

### 검증

- `Backend`, `django_backend` Python 문법 검사 통과
- React 프로덕션 빌드 통과
- 원격 `origin/version-1` 푸시 완료
