# PDF 개선 작업 추적

기준일: 2026-07-07
작업 브랜치: `integrate-eunjin-v2-0707`

## 1. 시작 상태

- `integrate-eunjin-v2-0707`은 `origin/final` 기준 2커밋 앞선 PR 대기 브랜치다.
- PDF MVP는 이미 구현되어 있다.
- 현재 흐름은 PDF 원본 저장 없이 텍스트/표를 추출하고, 추출 결과 `combined_text`를 React에서 확인한 뒤 전략 진단의 `announcement_text`로 넘긴다.
- 문제는 `combined_text`가 원문 추출에 가까워 사용자 검토 가치가 낮고, 진단 입력에도 불필요한 잡음이 많다는 점이다.

## 2. Baseline: 개선 전 PDF 처리 로직

작업 시작 시점의 기존 로직이다. 이후 변경사항과 비교하기 위한 기준선으로 둔다.

```text
React PdfAnalysis.tsx
  -> api.analyzePdf(file)
  -> Django PDFAnalyzeAPIView
      - 인증 필요
      - PDF 확장자/MIME 검사
      - 15MB 제한
      - 원본 저장 없이 bytes read
  -> FastAPI /api/pdf/analyze
      - PDF 확장자/MIME 검사
      - 빈 파일/15MB/%PDF 헤더 검사
  -> Backend/app/services/pdf_service.py
      - pdfplumber로 모든 페이지 텍스트 추출
      - pdfplumber로 모든 표 추출
      - 텍스트가 500자 미만이면 PyMuPDF fallback
      - 본문 앞 12,000자 + 표 최대 30개를 합쳐 combined_text 생성
      - combined_text 15,000자 초과 시 잘라냄
  -> React에서 preview/combined_text 표시
  -> 전략 진단 버튼 클릭
  -> StrategyRun.tsx state로 combined_text 전달
  -> POST /api/strategy announcement_text로 전송
  -> Django StrategyRun input_snapshot/result_payload 저장
  -> FastAPI /api/announcement가 Node4 LLM 구조화 후 상세 진단 실행
```

### Baseline 한계

- PDF가 길거나 표가 많으면 모든 페이지/표를 훑어 추출 시간이 길어질 수 있다.
- 사용자가 보는 내용이 raw 추출문에 가까워 “무엇을 확인하고 수정해야 하는지”가 명확하지 않다.
- 반복 안내문, 목차, 긴 유의사항, 표 깨짐 텍스트까지 함께 들어가 진단 입력 품질을 떨어뜨릴 수 있다.
- React에서 `combined_text`는 보여주지만, 진단 입력으로 사용할 공고 요약본과 원문 추출 일부가 분리되어 있지 않다.
- `pdf_analysis_id`가 PDF 분석 응답에는 있으나 전략 진단 요청까지 이어지지 않아 추후 이력 추적성이 약하다.
- 마이페이지/결과 상세에서 “어떤 PDF 공고를 기준으로 진단했는지”는 `source_filename`과 입력 스냅샷에 기대고 있으며, 정리된 공고문/요약본 저장 기준이 아직 명확하지 않다.

## 3. 개선 필요성

이번 개선은 단순히 PDF 텍스트를 더 많이 뽑는 것이 아니라, **진단에 쓸 수 있는 공고문 입력값을 더 빠르고 읽기 좋게 만드는 것**이 목적이다.

사용자 관점:

- raw 추출문을 그대로 보여주면 수정할 지점을 찾기 어렵다.
- 공고명, 공급 위치, 분양가, 청약 일정, 제한사항처럼 확인해야 할 항목이 먼저 보여야 한다.
- 나중에 마이페이지에서 내가 어떤 공고 기준으로 진단했는지 다시 이해할 수 있어야 한다.

진단 성능 관점:

- Node4는 자유 텍스트에서 공고 구조를 LLM으로 추출하므로, 입력값이 지저분할수록 구조화 품질이 흔들릴 수 있다.
- PDF 추출 단계에서 불필요한 잡음을 줄이고 핵심 항목 중심으로 정리하면 이후 결과 리포트 품질이 좋아질 가능성이 높다.
- LLM 요약이 실패해도 진단 흐름이 끊기지 않도록 규칙 기반 fallback이 필요하다.

개발/운영 관점:

- 실제 청약홈/마이홈 PDF는 페이지 수와 표가 많아 전체 표 추출 비용이 크다.
- PDF 원본은 저장하지 않는 기존 원칙은 유지한다.
- API 계약 변경은 문서에 남겨 React/Django/FastAPI 연결부가 같은 기준을 보게 한다.

## 4. 요구사항 정리

- PDF 텍스트 추출 시간을 줄인다.
- 사용자에게 raw 추출문이 아니라 의미 있는 검토용 공고 요약을 보여준다.
- 진단 입력에는 불필요한 잡음을 줄인 정리/요약 공고문을 사용한다.
- LLM 요약/정리를 반드시 붙이되, 실패 시에도 규칙 기반 정리 결과로 계속 진행한다.
- 추후 마이페이지에서 “어떤 공고를 넣었고, 그때 기준 진단/점수/레포트가 무엇이었는지” 볼 수 있게 저장 흐름을 보강한다.

## 5. 이번 작업 범위

- PDF 분석 응답에 정리/요약 필드를 추가한다.
- React PDF 화면은 정리된 공고문을 기본 미리보기/수정 대상으로 보여준다.
- 전략 진단에는 PDF 원문 추출문보다 정리된 공고문을 우선 전달한다.
- `pdf_analysis_id`를 전략 진단 요청까지 전달해 이력 추적성을 높인다.
- 문서/API 계약을 변경사항에 맞춰 갱신한다.

## 6. 1차 변경 후 PDF 처리 로직

2026-07-07 1차 구현 후 로직이다.

```text
React PdfAnalysis.tsx
  -> api.analyzePdf(file)
  -> Django PDFAnalyzeAPIView
      - 인증 필요
      - PDF 확장자/MIME 검사
      - 15MB 제한
      - 원본 저장 없이 bytes read
  -> FastAPI /api/pdf/analyze
      - PDF 확장자/MIME 검사
      - 빈 파일/15MB/%PDF 헤더 검사
  -> Backend/app/services/pdf_service.py
      - pdfplumber로 PDF 앞쪽 핵심 페이지 텍스트 추출
      - 초반 페이지 표를 제한적으로 추출
      - 텍스트가 500자 미만이면 PyMuPDF fallback
      - 규칙 기반으로 청약 핵심 항목/중요 문장을 정리
      - OPENAI_API_KEY가 있으면 LLM으로 사용자 검토용/진단 입력용 요약 생성
      - LLM 실패 시 규칙 기반 정리본 사용
  -> React에서 diagnosis_text를 편집 가능한 정리본으로 표시
  -> 원문 추출 일부는 raw_preview로 접어서 표시
  -> 전략 진단 버튼 클릭
  -> StrategyRun.tsx state로 확인/수정한 정리본과 pdf_analysis_id 전달
  -> POST /api/strategy announcement_text로 전송
  -> Django StrategyRun input_snapshot/result_payload 저장
  -> FastAPI /api/announcement가 Node4 LLM 구조화 후 상세 진단 실행
```

### 1차 변경 응답 필드

기존 필드는 유지하고 아래 필드를 추가했다.

```text
raw_preview
summary_text
diagnosis_text
summary_source
```

`combined_text`는 하위 호환 필드로 유지하되, 현재는 `diagnosis_text`와 같은 정리본을 담는다.

## 7. 검증 기록

- FastAPI import OK
- Django `manage.py check` OK
- Django `accounts strategy` tests 27 passed
- React tests 7 passed
- React production build OK
- 메모리 생성 PDF로 `analyze_pdf_bytes` 직접 호출해 새 응답 필드 생성 확인
- 단, 로컬 생성 PDF는 한글 폰트 추출이 깨져 실제 청약홈/마이홈 PDF 기준 품질 검증이 추가로 필요하다.
- 2차 구현 중 실제 PDF `2026000153 동작 센트럴 동문 디 이스트 입주자모집공고문.pdf`로 직접 검증했다.
  - 공고명: 동작 센트럴 동문 디 이스트 입주자모집공고
  - 공급 위치: 서울특별시 동작구 상도동 363-10번지 일원
  - 주택형/전용면적: 46, 51, 53, 56A, 56B, 58A, 58B, 58C, 59, 62 총 10개 주택형 추출
  - 공급금액 범위: 약 12.06억~17.07억 추출
  - 청약 일정/재당첨 제한/전매 제한/거주의무 추출
- 2차 구현 후 검증:
  - FastAPI import OK
  - Django `manage.py check` OK
  - Django `accounts strategy` tests 27 passed
  - React tests 7 passed
  - React production build OK

## 8. 남은 과제

- 실제 청약홈/마이홈 PDF 샘플로 추출 시간과 요약 품질을 확인한다.
- `OPENAI_API_KEY`가 있는 환경에서 LLM 요약 결과 품질을 확인한다.
- 마이페이지/결과 상세에서 정리된 공고문 요약과 진단 레포트가 함께 잘 보존되는지 점검한다.
- 필요하면 `StrategyRun.input_snapshot.announcement`에 PDF 요약 관련 메타데이터를 더 명확히 저장한다.
- 구조화 공고 필드(`announcement_name`, `region`, `sale_price_krw`, 일정 등)를 PDF 요약 단계에서 별도 필드로 뽑을지 검토한다.
- 마이페이지/결과 상세 제목은 공고가 있으면 아파트명/공고명, 공고가 없으면 `청약 가능성 분석`으로 보여주는 방향을 검토한다.

## 9. 2차 개선 로드맵: 짧은 사용자 요약 + 구조적 진단 입력

사용자 피드백 기준으로, PDF 요약은 공고문 대체본이 아니라 여러 공고를 비교하고 나중에 다시 식별하기 위한 짧은 핵심 카드 역할이면 충분하다고 판단했다. 반면 진단 입력은 Node4/LLM이 안정적으로 읽을 수 있도록 구조적이어야 한다.

### 왜 바꾸는가

- 마이페이지/결과 상세에는 “내가 어떤 공고를 넣었는지”만 빠르게 확인하면 되므로 장문 요약은 오히려 방해가 된다.
- 청약 가능성 검토에는 주택형/전용면적/공급금액 범위처럼 표 기반 필수 정보가 중요하다.
- 1차 개선 결과에서 공고명, 위치, 일정, 제한사항은 잘 잡혔지만 전용면적/분양가가 `확인 필요`로 남았다. 원문 7~8페이지 표에는 실제 값이 있으므로 표 기반 규칙 추출을 강화해야 한다.
- LLM은 최종 문장을 다듬는 보조 역할로 두고, 필수값은 가능한 한 규칙 기반으로 먼저 확보해야 한다.

### 구현 순서

1. `pdf_service.py`에 `extracted_fields`를 만든다.
   - 공고명, 공급 위치, 주택 유형, 규제지역 여부
   - 모집공고일, 청약 일정, 재당첨/전매/거주의무
   - 공급 세대수
   - 주택형/전용면적 목록
   - 공급금액 최저~최고 범위
2. `summary_text`와 `diagnosis_text`의 역할을 분리한다.
   - `summary_text`: 사용자 표시/이력용 짧은 핵심 요약
   - `diagnosis_text`: 전략 진단 입력용 구조화 텍스트
3. React에서 PDF 분석 결과를 전략 진단으로 넘길 때 `pdf_summary_text`, `pdf_extracted_fields`도 함께 넘긴다.
4. Django `input_snapshot.announcement`에 PDF 메타데이터를 저장한다.
5. 실제 동작 센트럴 동문 디 이스트 PDF로 전용면적/분양가 범위가 잡히는지 검증한다.

### 2차 구현 결과

- `extracted_fields`를 PDF 분석 응답에 추가했다.
- `summary_text`는 사용자 이력/확인용 짧은 핵심 요약으로 만들었다.
- `diagnosis_text`는 전략 진단 입력용 구조화 텍스트로 만들었다.
- `combined_text`는 하위 호환을 위해 유지하되 `diagnosis_text`와 같은 값을 담는다.
- React에서 PDF 분석 결과를 전략 진단으로 넘길 때 `pdf_summary_text`, `pdf_extracted_fields`도 함께 넘기도록 연결했다.
- Django는 새 PDF 메타데이터를 `StrategyRun.input_snapshot.announcement`에 저장한다.

2차 개선의 핵심 이유:

- 사용자에게는 공고문 전체 요약보다 “공고 식별과 비교에 필요한 짧은 요약”이 더 적합하다.
- 진단에는 자연어 장문보다 주택형/전용면적/공급금액/일정/제한사항이 구조적으로 정리된 입력이 더 적합하다.
- 실제 PDF에서 LLM이 표 기반 값을 놓칠 수 있으므로, 주택형과 공급금액 범위는 규칙 기반으로 먼저 추출한다.

## 10. 추적 로그

- 2026-07-07: 작업 시작. 현재 로직 확인 및 개선 방향 확정.
- 2026-07-07: FastAPI PDF 분석에 페이지/표 추출 제한, 규칙 기반 공고문 정리, 선택적 LLM 요약을 추가.
- 2026-07-07: React PDF 화면을 정리본 편집 중심으로 변경하고 `pdf_analysis_id`를 전략 진단 요청까지 전달하도록 연결.
- 2026-07-07: API 계약 문서에 `raw_preview`, `summary_text`, `diagnosis_text`, `summary_source` 필드 추가.
- 2026-07-07: 추적 파일을 baseline/개선 필요성/1차 변경 후 로직/검증 기록 구조로 재정리.
- 2026-07-07: 2차 개선 방향을 “짧은 사용자 요약 + 구조적 진단 입력 + 표 기반 필수 필드 추출”로 확정.
- 2026-07-07: 2차 구현으로 `extracted_fields`, 짧은 `summary_text`, 구조적 `diagnosis_text`, PDF 메타데이터 저장 흐름을 추가.
- 2026-07-07: 실제 동작 센트럴 동문 디 이스트 PDF로 주택형 10개와 공급금액 범위 추출을 검증.
- 2026-07-07: Django/FastAPI/React 검증 통과를 기록.
- 2026-07-07: 마이페이지/결과 상세 표시 로직을 보강했다. PDF 기반 진단은 `pdf_extracted_fields.announcement_name`을 우선 제목으로 사용하고, 공고 없는 진단은 `청약 가능성 분석`으로 통일했다. 시간은 기존 `created_at` 별도 표시를 유지해 제목이 길어지지 않게 했다.
