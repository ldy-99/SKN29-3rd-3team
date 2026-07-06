# 변경 이력

세부 파일별 작업 일지 대신 통합 상태에 영향을 주는 변경만 기록합니다.

## 2026-07-06 — `jihun` 브랜치 병합

- 최신 `origin/version-1`을 기준으로 `origin/jihun` 병합
- LLM 안전 처리 모듈 추가 및 파이프라인 노드의 오류·fallback 처리 강화
- 파이프라인과 채팅 체크포인트를 프로세스 메모리 대신 SQLite에 저장
- ChromaDB 또는 API 키 문제로 FastAPI 전체가 시작되지 않도록 채팅 그래프 지연 초기화
- RAG 도구, 채팅 router/service, 파이프라인 재개 및 오류 응답 처리 보완
- 실제 FastAPI 응답 구조에 맞게 Django serializer와 React 결과 상세 필드 정리
- 관련 의존성과 `.gitignore` 갱신

검증:

- 병합 충돌 없음
- `Backend`, `django_backend` Python 문법 검사 통과
- React production build 통과
- 원본 커밋 `bf0c5ff`, 병합 커밋 `4019b00`

## 2026-07-03 — PDF 텍스트 추출 MVP

- FastAPI `/api/pdf/analyze` endpoint 추가
- `pdfplumber.dedupe_chars()` 기반 PDF 텍스트 추출 추가
- PDF 표 추출 결과를 `combined_text`에 병합
- PyMuPDF fallback 추가
- Django PDF proxy에 15MB 크기 제한 추가
- React PDF 화면을 실제 파일 선택/업로드/미리보기 흐름으로 연결
- 추출된 `combined_text`를 기존 전략 진단 `announcement_text` 입력으로 전달
- PDF 원본 파일은 저장하지 않고 사용자 진단 이력에는 입력 방식과 파일명만 snapshot으로 보존
- ChromaDB HNSW query 오류가 FastAPI `/api/announcement` 500으로 전파되지 않도록 RAG 검색 실패 방어 처리 추가

검증:

- 청약홈 실제 모집공고 PDF 샘플 추출 성공
- 마이홈 실제 모집공고 PDF 샘플 추출 성공
- Django `manage.py check` 통과
- Django `strategy` 테스트 13개 통과
- RAG retriever 예외 시 `found=False` 반환 확인
- React build는 Node v24.14.0 + pnpm 환경에서 통과

## 2026-07-02 — 문서·환경 정리

- 기존 Streamlit `Frontend/` 제거
- React → Django → FastAPI/RAG 3서비스 구조로 README 갱신
- FastAPI/RAG와 Django requirements 분리·버전 고정
- 루트 및 React `.env.example` 추가
- Django secret, origin, FastAPI URL, timeout 환경변수 적용
- 실행·환경·역할·계약 문서를 용도별 기준 문서로 통합
- 중복 walkthrough, kickoff, 역할별 복사 문서 제거

검증:

- 독립 Python 3.10 환경 clean install 성공
- dependency conflict 없음
- Django 22개 테스트 통과
- FastAPI app과 router import 성공
- React production build 통과

관련 커밋:

```text
436fe8c Remove legacy Streamlit frontend
7081f78 Make local service configuration reproducible
fd5164a Add integrated local setup deliverables
```

## 2026-07-01 — React UX 개선

- 전략 진단 경과시간과 예상 대기시간 표시
- 함수 레벨 중복 실행 방지
- 95초 frontend abort와 502·프로필 오류 메시지 분기
- 실행 중 프로필·PDF 화면 이동 방지
- 챗봇 답변 카드, 문단·목록 가독성 개선
- 답변과 출처 분리, 출처 toggle 추가
- 긴 답변의 scroll 위치와 입력 중복 처리 개선

검증:

- React production build 통과
- 실제 Django/FastAPI 챗봇 응답 화면 확인

관련 커밋:

```text
b86b62c Improve strategy diagnosis loading UX
270266e Redesign chatbot response experience
```

## 2026-06-26~29 — React·Django·FastAPI 1차 통합

- React 인증 요청과 Django serializer 정합성 보완
- session credential과 로컬 CORS origin 정리
- 신규 사용자 프로필 404를 빈 작성 화면으로 처리
- Profile에 추가 진단 필드 반영
- React Profile을 실제 form으로 연결
- Strategy 요청에 수동 공고문과 profile-only 경로 연결
- Django `StrategyRun`에 입력 snapshot과 결과 저장
- FastAPI 호출 순서를 `profile → simulate → announcement`로 수정
- Result가 실제 FastAPI payload를 표시하도록 대응
- 챗봇 proxy와 질문 흐름 연결

검증:

- React 회원가입
- Django session 인증
- 프로필 저장
- 수동 공고문 전략 진단
- 결과 조회
- 챗봇 질문
- Django 테스트 22개, React build 통과

관련 커밋:

```text
12896fb Integrate React and Django prototype flow
637799e Merge React-Django-FastAPI integration
```

## 현재 미완료

- Result 응답 adapter 최종 단일화
- 표준 CSRF 적용
- LLM 초기화와 FastAPI app import 분리
- Docker Compose·배포·CI
