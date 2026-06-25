# D. AI/FastAPI/RAG 작업 가이드

## 1. 역할 요약

AI/FastAPI/RAG 담당자는 3차 프로젝트에서 만든 LangGraph, RAG, 계산 로직을 4차 웹 서비스 구조에 맞게 재사용할 수 있도록 정리합니다.  
핵심은 새 기능을 많이 만드는 것이 아니라, Django가 안정적으로 호출할 수 있는 내부 AI API 경계를 만드는 것입니다.

## 2. 우선 책임

| 영역 | 할 일 |
|---|---|
| FastAPI 실행 | 기존 AI 기능을 내부 API 또는 wrapper로 실행 가능하게 정리 |
| adapter | 4차 공개 API 필드를 3차 내부 schema로 변환 |
| 계산 로직 | 청약 가점, 자격, 자금 부담 등 규칙 기반 계산 유지 |
| 공고 구조화 | PDF 분석 결과를 기본으로 구조화하고, 실패·미보유 시 수동 공고 입력 fallback을 구조화 |
| RAG 챗봇 | 기존 ChromaDB/RAG 챗봇을 Django proxy 뒤에서 동작하게 준비 |
| 실패 처리 | AI 실패 시 전체 서비스가 500으로 무너지지 않게 부분 결과 반환 |

## 3. Day 1~2 결정 항목

| 항목 | 결정해야 할 것 |
|---|---|
| FastAPI 실행 방식 | HTTP 호출로 갈지, local import wrapper로 갈지 결정 |
| ChromaDB 준비 방식 | Git에 포함하지 않고 재빌드 방식으로 준비 |
| adapter 기준 | null 보존, enum alias, 3차 필드명 변환 방식 확정 |
| fixture 진단 | 정상/누락/부분 진단 fixture가 실행되는지 확인 |
| 챗봇 smoke test | 고정 질문 1~3개에 대해 답변과 출처가 나오는지 확인 |

## 4. adapter 원칙

4차 공개 API 필드를 3차 FastAPI schema에 그대로 맞추려 하지 않습니다. 변환은 adapter에서 한 번만 합니다.

```text
Django 공개 API payload
  → ProfileAdapter
  → 3차 FastAPI/LangGraph 내부 DTO
  → 계산/전략 결과
  → Django 공개 API 응답 형태로 정리
```

중요한 규칙:

| 규칙 | 설명 |
|---|---|
| null 보존 | 모르는 값은 `null`로 유지합니다. |
| 0과 false 구분 | `0`, `false`, `null`은 서로 다른 의미입니다. |
| 파생값은 내부에서 생성 | `bankbook_joined_months` 같은 값은 adapter 또는 계산 context에서 생성합니다. |
| 공개 API 오염 방지 | 3차 내부 필드명을 React에 노출하지 않습니다. |

## 5. 계산과 LLM 역할 분리

정확성이 중요한 판단은 규칙 기반 로직으로 처리합니다. LLM은 설명, 구조화, 전략 문장 생성에 집중합니다.

| 영역 | 처리 방식 |
|---|---|
| 청약 가점 | 규칙 기반 계산 |
| 1순위/자격 판단 | 규칙 기반 계산 |
| 자금 부담 | 규칙 기반 계산 |
| 공고문 구조화 | PDF 분석 결과 또는 수동 입력을 LLM으로 보조 구조화 |
| 최종 전략 설명 | LLM 보조 가능 |
| 챗봇 답변 | RAG 기반 답변 |

## 6. FastAPI 내부 API 기준

FastAPI는 브라우저에 공개하지 않습니다. Django가 내부에서 호출합니다.

| API 후보 | 목적 |
|---|---|
| `POST /internal/diagnosis` | 프로필 기반 청약 진단 |
| `POST /internal/announcement/parse` | 공고 입력 구조화 |
| `POST /internal/strategy` | 프로필+공고 기반 전략 생성 |
| `POST /internal/chatbot` | RAG 챗봇 답변 |

실제 경로는 팀 계약에 맞추되, 외부 공개 API와 내부 AI API를 분리하는 것이 중요합니다.

## 7. 실패 처리 기준

AI/RAG는 외부 의존성이 있으므로 실패할 수 있습니다. 실패해도 가능한 계산 결과는 반환해야 합니다.

| 실패 상황 | 처리 |
|---|---|
| LLM 호출 실패 | 규칙 기반 결과와 오류 코드를 함께 반환 |
| RAG collection 없음 | 챗봇 smoke test 실패로 기록하고 준비 방식 재검토 |
| 공고 구조화 실패 | 수동 공고 입력 fallback 안내 |
| 일부 필드 누락 | 해당 공급유형만 `PARTIAL` 또는 `SKIPPED_MISSING_INPUTS` |
| FastAPI timeout | Django가 구조화된 오류로 변환할 수 있게 오류 코드 반환 |

## 8. 챗봇/RAG 체크리스트

| 체크 | 질문 |
|---|---|
| ChromaDB | 로컬에서 collection이 조회되는가? |
| 고정 질문 | “청약통장 가입일은 왜 필요한가요?” 같은 질문에 답하는가? |
| 출처 | 답변에 참고 자료가 포함되는가? |
| 실패 메시지 | 검색 실패 시 사용자가 이해할 수 있는 메시지를 줄 수 있는가? |
| Django proxy | React가 FastAPI를 직접 호출하지 않는가? |

## 9. PR 전 확인

- 4차 공개 API 필드를 직접 FastAPI 내부 schema로 강제하지 않았는지 확인합니다.
- fixture 입력으로 진단이 재현되는지 확인합니다.
- LLM/RAG 실패 시 전체 요청이 500으로만 끝나지 않는지 확인합니다.
- ChromaDB 경로, LLM API key 등 환경변수 이름을 문서에 남깁니다.
- 계산 로직 변경이 있으면 테스트 fixture를 함께 수정합니다.
