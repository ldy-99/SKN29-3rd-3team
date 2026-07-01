# 변경 이력

세부 파일별 작업 일지 대신 통합 상태에 영향을 주는 변경만 기록합니다.

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

- FastAPI `/api/pdf/analyze`
- Result 응답 adapter 최종 단일화
- 표준 CSRF 적용
- LLM 초기화와 FastAPI app import 분리
- Docker Compose·배포·CI
