"""
역할: 업로드된 모집공고 PDF를 저장하지 않고 텍스트/표 입력값으로 변환합니다.
흐름: pdf_router -> analyze_pdf_bytes -> pdfplumber/PyMuPDF -> 핵심 필드 추출 -> React 확인/전략 진단 입력.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any
from uuid import uuid4
import os
import re

import fitz
import pdfplumber
from langchain_openai import ChatOpenAI

from src.engine.llm_safety import LLMCallError, safe_llm_call


# 청약 공고 PDF는 표가 많아 전체 추출 비용이 커서, 화면/진단에 필요한 범위를 먼저 제한합니다.
MAX_COMBINED_TEXT_CHARS = 15_000
MAX_PREVIEW_CHARS = 2_000
MAX_RAW_TEXT_CHARS_FOR_SUMMARY = 35_000
MAX_RULE_SUMMARY_CHARS = 8_000
MAX_LLM_INPUT_CHARS = 12_000
MAX_PAGES_TO_SCAN = 40
MAX_TABLE_PAGES_TO_SCAN = 15
MAX_TABLES_FOR_DIAGNOSIS = 18
MAX_TABLE_ROWS_FOR_DIAGNOSIS = 220


@dataclass
class PDFTable:
    page: int
    rows: list[list[str]]


def analyze_pdf_bytes(file_name: str, content: bytes) -> dict[str, Any]:
    """
    PDF 원본은 보관하지 않고 요청 처리 중 메모리에서만 읽습니다.
    청약홈/마이홈 PDF는 표가 많고 일부 글자가 겹쳐 찍혀 dedupe 후 추출을 기본값으로 둡니다.
    반환값은 사용자 이력용 summary_text와 전략 진단용 diagnosis_text를 분리합니다.
    """
    warnings: list[str] = []
    text_parts: list[str] = []
    tables: list[PDFTable] = []
    page_count = 0

    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            page_count = len(pdf.pages)
            scan_pages = min(page_count, MAX_PAGES_TO_SCAN)
            if page_count > MAX_PAGES_TO_SCAN:
                warnings.append(
                    f"{page_count}쪽 PDF 중 앞 {MAX_PAGES_TO_SCAN}쪽을 우선 분석했습니다. "
                    "청약 핵심 조건은 보통 앞부분에 있어 추출 시간을 줄이기 위한 처리입니다."
                )

            for index, page in enumerate(pdf.pages[:scan_pages], start=1):
                working_page = page
                try:
                    working_page = page.dedupe_chars()
                except Exception as exc:
                    warnings.append(f"{index}페이지 중복 글자 제거 실패: {exc}")

                extracted_text = working_page.extract_text() or ""
                if extracted_text.strip():
                    text_parts.append(f"[page {index}]\n{extracted_text.strip()}")

                if index <= MAX_TABLE_PAGES_TO_SCAN and len(tables) < MAX_TABLES_FOR_DIAGNOSIS:
                    for table in working_page.extract_tables() or []:
                        normalized_rows = _normalize_table(table)
                        if normalized_rows:
                            tables.append(PDFTable(page=index, rows=normalized_rows))
                        if len(tables) >= MAX_TABLES_FOR_DIAGNOSIS:
                            break
    except Exception as exc:
        raise ValueError(f"PDF 텍스트 추출에 실패했습니다: {exc}") from exc

    text = _clean_text("\n\n".join(text_parts))

    if len(text) < 500:
        fallback_text, fallback_page_count = _extract_with_pymupdf(content)
        if len(fallback_text) > len(text):
            text = fallback_text
            page_count = fallback_page_count
            warnings.append("pdfplumber 추출 텍스트가 짧아 PyMuPDF fallback 결과를 사용했습니다.")

    table_text = _format_tables(tables[:MAX_TABLES_FOR_DIAGNOSIS], max_rows=MAX_TABLE_ROWS_FOR_DIAGNOSIS)
    raw_for_summary = _clean_text("\n\n".join(part for part in [text[:MAX_RAW_TEXT_CHARS_FOR_SUMMARY], table_text] if part.strip()))
    extracted_fields = _extract_notice_fields(file_name, raw_for_summary)
    user_summary = _build_user_notice_summary(extracted_fields)
    diagnosis_text = _build_diagnosis_notice_text(extracted_fields)
    llm_summary = _summarize_notice_with_llm(user_summary, diagnosis_text, raw_for_summary, warnings)
    summary_source = "llm" if llm_summary else "rule"
    summary_text = _clean_text(llm_summary or user_summary)
    combined_text = _clean_text(diagnosis_text)

    if not combined_text.strip():
        warnings.append("PDF에서 읽을 수 있는 텍스트를 찾지 못했습니다. 스캔본이면 직접 입력이 필요합니다.")

    truncated = False
    if len(combined_text) > MAX_COMBINED_TEXT_CHARS:
        combined_text = combined_text[:MAX_COMBINED_TEXT_CHARS].rstrip()
        truncated = True
        warnings.append("진단 입력용 텍스트가 길어 일부 표/본문은 제외했습니다.")

    return {
        "pdf_analysis_id": str(uuid4()),
        "extraction_status": "NEEDS_REVIEW" if warnings else "EXTRACTED",
        "filename": file_name,
        "page_count": page_count,
        "text_length": len(text),
        "combined_text_length": len(combined_text),
        "table_count": len(tables),
        "truncated": truncated,
        "preview": combined_text[:MAX_PREVIEW_CHARS],
        "raw_preview": text[:MAX_PREVIEW_CHARS],
        "summary_text": summary_text,
        "diagnosis_text": combined_text,
        "summary_source": summary_source,
        "extracted_fields": extracted_fields,
        "combined_text": combined_text,
        "tables": [_table_to_dict(table) for table in tables[:20]],
        "warnings": warnings,
    }


def _extract_with_pymupdf(content: bytes) -> tuple[str, int]:
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        parts = [
            f"[page {index + 1}]\n{page.get_text(sort=True).strip()}"
            for index, page in enumerate(doc)
            if page.get_text(sort=True).strip()
        ]
        return _clean_text("\n\n".join(parts)), doc.page_count
    finally:
        doc.close()


def _normalize_table(table: list[list[Any]]) -> list[list[str]]:
    rows: list[list[str]] = []
    for row in table:
        cells = [_clean_cell(cell) for cell in row]
        if any(cells):
            rows.append(cells)
    return rows


def _format_tables(tables: list[PDFTable], *, max_rows: int | None = None) -> str:
    if not tables:
        return ""

    chunks: list[str] = ["[extracted tables]"]
    row_count = 0
    for table_index, table in enumerate(tables, start=1):
        chunks.append(f"[table {table_index} / page {table.page}]")
        for row in table.rows:
            if max_rows is not None and row_count >= max_rows:
                chunks.append("[표 일부 생략]")
                return "\n".join(chunks)
            chunks.append(" | ".join(row))
            row_count += 1
    return "\n".join(chunks)


def _table_to_dict(table: PDFTable) -> dict[str, Any]:
    return {"page": table.page, "rows": table.rows}


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    return _clean_text(str(value))


def _clean_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_notice_fields(file_name: str, text: str) -> dict[str, Any]:
    # LLM 요약 전에 규칙 기반 핵심값을 먼저 확보해 숫자/일정 누락을 줄입니다.
    title = _extract_title(file_name, text)
    schedule = _extract_schedule(text)
    price_summary = _extract_price_summary(text)
    housing_types = _extract_housing_types(text)
    supply_counts = _extract_supply_counts(text)

    return {
        "announcement_name": title,
        "location": _find_labeled_value(text, ["공급 위치", "공급위치", "건설 위치", "건설위치", "위치"]),
        "housing_category": _detect_housing_category(text),
        "regulated_area": _detect_regulated_area(text),
        "announcement_date": _find_announcement_date(text),
        "supply_summary": supply_counts,
        "housing_types": housing_types,
        "price_summary": price_summary,
        "schedule": schedule,
        "residence_requirement": _extract_residence_requirement(text),
        "rewinning_restriction": _extract_restriction(text, ["재당첨제한", "재당첨 제한"]),
        "resale_restriction": _extract_restriction(text, ["전매제한", "전매 제한"]),
        "residence_obligation": _extract_restriction(text, ["거주의무기간", "거주의무"]),
    }


def _build_user_notice_summary(fields: dict[str, Any]) -> str:
    # 마이페이지에서 여러 진단을 구분하는 용도라 장문 요약 대신 핵심 카드처럼 짧게 만듭니다.
    price = fields.get("price_summary") or {}
    supply = fields.get("supply_summary") or {}
    schedule = fields.get("schedule") or {}
    housing_types = fields.get("housing_types") or []

    chunks = ["[PDF 공고문 핵심 요약]"]
    chunks.append(str(fields.get("announcement_name") or "공고명 확인 필요"))
    if fields.get("location"):
        chunks.append(str(fields["location"]))

    tags = [
        fields.get("housing_category"),
        fields.get("regulated_area"),
    ]
    tag_line = " · ".join(str(tag) for tag in tags if tag)
    if tag_line:
        chunks.append(tag_line)
    if fields.get("announcement_date"):
        chunks.append(f"모집공고일 {fields['announcement_date']}")

    supply_line = _format_supply_summary(supply)
    if supply_line:
        chunks.extend(["", f"공급: {supply_line}"])
    if housing_types:
        chunks.append(f"주택형: {_format_housing_type_range(housing_types)}")
    if price.get("min_krw") and price.get("max_krw"):
        chunks.append(
            f"공급금액: 약 {_format_eok(price['min_krw'])}~{_format_eok(price['max_krw'])}"
        )

    schedule_lines = _format_schedule_lines(schedule)
    if schedule_lines:
        chunks.extend(["", "청약 일정:"])
        chunks.extend(f"- {line}" for line in schedule_lines)

    restriction_lines = [
        fields.get("residence_requirement"),
        f"재당첨 제한 {fields['rewinning_restriction']}" if fields.get("rewinning_restriction") else None,
        f"전매 제한 {fields['resale_restriction']}" if fields.get("resale_restriction") else None,
        f"거주의무 {fields['residence_obligation']}" if fields.get("residence_obligation") else None,
    ]
    restriction_lines = [str(line) for line in restriction_lines if line]
    if restriction_lines:
        chunks.extend(["", "주요 제한:"])
        chunks.extend(f"- {line}" for line in restriction_lines[:5])

    return _clean_text("\n".join(chunks))[:MAX_RULE_SUMMARY_CHARS].rstrip()


def _build_diagnosis_notice_text(fields: dict[str, Any]) -> str:
    # FastAPI 진단 노드가 원문 잡음보다 구조화된 항목을 먼저 읽도록 만든 입력값입니다.
    price = fields.get("price_summary") or {}
    supply = fields.get("supply_summary") or {}
    schedule = fields.get("schedule") or {}
    housing_types = fields.get("housing_types") or []

    chunks = ["[아파트 청약 진단용 공고문 정리]"]
    items = [
        ("공고명", fields.get("announcement_name")),
        ("공급위치", fields.get("location")),
        ("주택유형", fields.get("housing_category")),
        ("규제지역", fields.get("regulated_area")),
        ("입주자모집공고일", fields.get("announcement_date")),
        ("공급규모", _format_supply_summary(supply)),
        ("주택형/전용면적", _format_housing_types_for_diagnosis(housing_types)),
        (
            "공급금액 범위",
            f"{price.get('min_krw'):,}원 ~ {price.get('max_krw'):,}원"
            if price.get("min_krw") and price.get("max_krw")
            else None,
        ),
        ("거주요건", fields.get("residence_requirement")),
        ("재당첨제한", fields.get("rewinning_restriction")),
        ("전매제한", fields.get("resale_restriction")),
        ("거주의무", fields.get("residence_obligation")),
    ]
    for label, value in items:
        chunks.append(f"- {label}: {value or '확인 필요'}")

    schedule_lines = _format_schedule_lines(schedule)
    if schedule_lines:
        chunks.extend(["", "## 청약 일정"])
        chunks.extend(f"- {line}" for line in schedule_lines)

    return _clean_text("\n".join(chunks))[:MAX_RULE_SUMMARY_CHARS].rstrip()


def _summarize_notice_with_llm(user_summary: str, diagnosis_text: str, raw_text: str, warnings: list[str]) -> str | None:
    if not os.getenv("OPENAI_API_KEY"):
        warnings.append("OPENAI_API_KEY가 없어 LLM 요약 대신 규칙 기반 정리본을 사용했습니다.")
        return None

    prompt = f"""
너는 한국 아파트 분양 청약 공고문을 사용자 이력 카드용으로 짧게 정리하는 도우미다.
목표는 공고문 전체 대체가 아니라, 사용자가 나중에 여러 공고 중 어떤 공고였는지 빠르게 식별하게 하는 것이다.

규칙:
- 아래 [규칙 기반 핵심 요약]의 숫자와 날짜를 우선 사용한다.
- 주택형/공급금액이 이미 있으면 절대 "확인 필요"로 바꾸지 않는다.
- 앱 설치 안내, 콜센터 일반 안내, 법령 장문, 반복 유의사항, 홍보 문구는 제외한다.
- 12줄 이내로 간결하게 작성한다.
- 값을 지어내지 않는다.

[규칙 기반 핵심 요약]
{user_summary[:MAX_LLM_INPUT_CHARS]}

[진단용 구조 텍스트]
{diagnosis_text[:MAX_LLM_INPUT_CHARS]}

[PDF 추출 원문 일부]
{raw_text[:4000]}
""".strip()

    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        content = safe_llm_call(
            lambda: llm.invoke(prompt).content,
            node_name="pdf_notice_summary",
            max_retries=0,
        )
        summary = _clean_text(str(content))
        if summary:
            return summary[:MAX_COMBINED_TEXT_CHARS].rstrip()
    except LLMCallError as exc:
        warnings.append(f"LLM 공고문 요약에 실패해 규칙 기반 정리본을 사용했습니다: {exc.message}")
    return None


def _extract_title(file_name: str, text: str) -> str:
    for label in ["공고명", "단지명", "아파트명", "주택명", "사업명"]:
        value = _find_labeled_value(text, [label])
        cleaned = _clean_title(value) if value else ""
        if cleaned:
            return cleaned

    lines = [
        line.strip()
        for line in text.replace("\r", "").split("\n")
        if line.strip()
    ][:80]
    for line in lines:
        if len(line) <= 120 and re.search(r"(아파트|자이|힐스테이트|푸르지오|래미안|아이파크|롯데캐슬|더샵|e편한세상).*(모집공고|분양)", line):
            cleaned = _clean_title(line)
            if cleaned:
                return cleaned
        if len(line) <= 120 and "입주자모집공고" in line:
            cleaned = _clean_title(line)
            if cleaned:
                return cleaned

    return _clean_title(file_name)


def _clean_title(value: str) -> str:
    cleaned = re.sub(r"\.(pdf|hwp|hwpx|docx?)$", "", value, flags=re.I)
    cleaned = re.sub(r"^[\s■●ㆍ\-•]+", "", cleaned)
    cleaned = cleaned.replace("_", " ").replace("-", " ")
    cleaned = re.sub(r"\s*(?:입주자\s*모집공고|분양\s*공고|모집공고문|공고문)\s*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s*(?:미분양|매입|잔여세대|선착순|일반매각|일반분양|임대주택).*$", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if _is_unusable_title(cleaned):
        return ""
    return cleaned


def _is_unusable_title(value: str) -> bool:
    if len(value) < 2 or len(value) > 60:
        return True
    return bool(re.search(r"금회|정부의|방안|마련|협조|따라|우리\s*공사|공급하는\s*주택", value))


def _find_labeled_value(text: str, labels: list[str]) -> str | None:
    escaped_labels = [re.escape(label) for label in labels]
    label_pattern = "|".join(escaped_labels)
    patterns = [
        rf"(?:^|\n)\s*[■●ㆍ\-•]?\s*(?:{label_pattern})\s*[:：]\s*([^\n]+)",
        rf"(?:{label_pattern})\s*[|]\s*([^|\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I)
        if match:
            value = re.sub(r"\s+", " ", match.group(1)).strip(" -|")
            if value:
                return value[:220]
    return None


def _detect_housing_category(text: str) -> str | None:
    if re.search(r"(민영|민간택지|민간분양)", text):
        return "민영주택"
    if re.search(r"(공공분양|국민주택|LH|SH)", text):
        return "공공주택"
    return None


def _detect_regulated_area(text: str) -> str | None:
    labels: list[str] = []
    if "투기과열지구" in text:
        labels.append("투기과열지구")
    if "청약과열지역" in text:
        labels.append("청약과열지역")
    if "조정대상지역" in text:
        labels.append("조정대상지역")
    if "비규제" in text and not labels:
        return "비규제지역"
    return ", ".join(dict.fromkeys(labels)) if labels else None


def _find_announcement_date(text: str) -> str | None:
    value = _find_labeled_value(text, ["입주자 모집공고일", "입주자모집공고일", "모집공고일"])
    if value:
        date = _find_date(value)
        if date:
            return date
    match = re.search(r"최초\s*입주자모집공고일은\s*([0-9]{4}[.년]\s*[0-9]{1,2}[.월]\s*[0-9]{1,2})", text)
    if match:
        return _find_date(match.group(1))
    return None


def _extract_schedule(text: str) -> dict[str, str]:
    schedule: dict[str, str] = {}
    normalized = text.replace("‘", "'").replace("’", "'").replace("`", "'")

    patterns = {
        "special_supply": [r"특별공급\s*(?:접수일)?\s*[:：]?\s*'?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2})"],
        "first_priority": [r"1순위\s*(?:접수일)?\s*[:：]?\s*'?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2})"],
        "second_priority": [r"2순위\s*(?:접수일)?\s*[:：]?\s*'?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2})"],
        "winner_announcement": [r"당첨자\s*발표(?:일)?\s*[:：]?\s*'?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2})"],
    }

    # 청약홈 PDF의 첫 일정표는 한 줄에 날짜가 순서대로 붙는 경우가 많다.
    schedule_line = next(
        (
            line
            for line in normalized.splitlines()
            if "일정" in line and "특별공급" not in line and len(re.findall(r"[0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2}", line)) >= 5
        ),
        None,
    )
    if schedule_line:
        dates = [_normalize_date(date) for date in re.findall(r"[0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2}", schedule_line)]
        keys = [
            "announcement_date",
            "special_supply",
            "first_priority_local",
            "first_priority_other",
            "second_priority",
            "winner_announcement",
        ]
        for key, date in zip(keys, dates):
            schedule[key] = date
        if len(dates) >= 8:
            schedule["document_submission"] = f"{dates[6]} ~ {dates[7]}"
        if len(dates) >= 10:
            schedule["contract_period"] = f"{dates[8]} ~ {dates[9]}"

    for key, key_patterns in patterns.items():
        if key in schedule:
            continue
        for pattern in key_patterns:
            match = re.search(pattern, normalized)
            if match:
                schedule[key] = _normalize_date(match.group(1))
                break

    contract_match = re.search(
        r"계약체결.*?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2}).{0,20}?~\s*'?([0-9]{2,4}[.][0-9]{1,2}[.][0-9]{1,2})",
        normalized,
        flags=re.S,
    )
    if contract_match and "contract_period" not in schedule:
        schedule["contract_period"] = f"{_normalize_date(contract_match.group(1))} ~ {_normalize_date(contract_match.group(2))}"

    return schedule


def _extract_supply_counts(text: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    supply_line = _find_labeled_value(text, ["공급규모", "공급 규모"])
    if supply_line:
        result["text"] = supply_line

    total_match = re.search(r"총\s*([0-9,]+)\s*세대", text)
    general_match = re.search(r"일반분양\s*([0-9,]+)\s*세대", text)
    special_match = re.search(r"특별공급\s*([0-9,]+)\s*세대", text)
    if total_match:
        result["total_households"] = _parse_int(total_match.group(1))
    if general_match:
        result["general_supply_households"] = _parse_int(general_match.group(1))
    if special_match:
        result["special_supply_households"] = _parse_int(special_match.group(1))
    return result


def _extract_housing_types(text: str) -> list[dict[str, Any]]:
    housing_types: list[dict[str, Any]] = []
    seen: set[str] = set()

    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        match = re.search(
            r"(?:^|\s)(\d{1,2})\s+([0-9]{3}[.][0-9]{4}[A-Z]?)\s+([0-9]{2}[A-Z]?)\s+([0-9]{2}[.][0-9]{4})\s+.*?\s([0-9,]+)\s+(?:\d+|-)",
            line,
        )
        if not match:
            continue
        _, full_type, short_type, exclusive_area, total_count = match.groups()
        if short_type in seen:
            continue
        housing_types.append(
            {
                "type": short_type,
                "full_type": full_type,
                "exclusive_area_sqm": float(exclusive_area),
                "supply_household_count": _parse_int(total_count),
            }
        )
        seen.add(short_type)

    if housing_types:
        return housing_types

    type_line_match = re.search(r"공고상\(청약시\)\s*주택형\s+([0-9A-Z.\s]+)", text)
    if type_line_match:
        for token in re.findall(r"[0-9]{3}[.][0-9]{4}[A-Z]?", type_line_match.group(1)):
            short_type = _short_housing_type(token)
            if short_type not in seen:
                housing_types.append({"type": short_type, "full_type": token})
                seen.add(short_type)
    return housing_types


def _extract_price_summary(text: str) -> dict[str, Any]:
    section = _section_after(text, "공급금액 및 납부일정", max_chars=9000)
    price_values: list[int] = []

    for line in section.splitlines():
        money_values = [_parse_int(value) for value in re.findall(r"\d{1,3}(?:,\d{3}){2,}", line)]
        money_values = [value for value in money_values if value]
        if len(money_values) >= 3:
            # 공급금액 표는 대지비, 건축비, 공급금액 순서로 숫자가 나온다.
            supply_amount = money_values[2]
            if supply_amount >= 100_000_000:
                price_values.append(supply_amount)

    if not price_values:
        all_values = [_parse_int(value) for value in re.findall(r"\d{1,3}(?:,\d{3}){2,}", section)]
        price_values = [value for value in all_values if value and value >= 500_000_000]

    if not price_values:
        return {}

    return {
        "min_krw": min(price_values),
        "max_krw": max(price_values),
        "count": len(price_values),
        "note": "주택형/층별 공급금액 기준",
    }


def _extract_residence_requirement(text: str) -> str | None:
    if re.search(r"서울특별시\s*2년\s*이상\s*(?:계속\s*)?거주자", text):
        return "서울특별시 2년 이상 거주자 우선"

    patterns = [
        r"서울특별시\s*2년\s*이상\s*거주자[^.\n]*우선",
        r"서울특별시\s*2년\s*이상\s*계속\s*거주자",
        r"해당\s*주택건설지역인\s*서울특별시\s*2년\s*이상\s*거주자[^.\n]*우선",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return re.sub(r"\s+", " ", match.group(0)).strip()
    return None


def _extract_restriction(text: str, labels: list[str]) -> str | None:
    table_match = re.search(
        r"재당첨제한\s+전매제한\s+거주의무기간[^\n]*\n\s*([^\n]+)",
        text,
    )
    if table_match:
        values = re.sub(r"\s+", " ", table_match.group(1)).strip().split()
        normalized_label = labels[0].replace(" ", "")
        if normalized_label == "재당첨제한" and values:
            return values[0]
        if normalized_label == "전매제한" and len(values) >= 2:
            return values[1]
        if normalized_label in ["거주의무기간", "거주의무"] and len(values) >= 3:
            return values[2]

    for label in labels:
        escaped = re.escape(label)
        line_match = re.search(rf"(?:^|\n)[^\n]*{escaped}[^\n]*", text)
        if line_match:
            line = re.sub(r"\s+", " ", line_match.group(0)).strip()
            if label.replace(" ", "") in ["거주의무기간", "거주의무"] and "없음" in line:
                return "없음"
            if label.replace(" ", "") in ["재당첨제한"] and "10년" in line:
                return "10년"
            if label.replace(" ", "") in ["전매제한"] and ("3년" in line or "소유권이전등기" in line):
                return "소유권이전등기일까지(3년 초과 시 3년)"
            return line[:120]
    return None


def _format_supply_summary(supply: dict[str, Any]) -> str | None:
    if not supply:
        return None
    parts: list[str] = []
    if supply.get("total_households"):
        parts.append(f"총 {supply['total_households']:,}세대")
    if supply.get("general_supply_households"):
        parts.append(f"일반분양 {supply['general_supply_households']:,}세대")
    if supply.get("special_supply_households"):
        parts.append(f"특별공급 {supply['special_supply_households']:,}세대")
    return ", ".join(parts) or supply.get("text")


def _format_housing_type_range(housing_types: list[dict[str, Any]]) -> str:
    labels = [str(item.get("type")) for item in housing_types if item.get("type")]
    if not labels:
        return "확인 필요"
    if len(labels) <= 8:
        return ", ".join(labels)
    return f"{labels[0]}~{labels[-1]}형 ({len(labels)}개 주택형)"


def _format_housing_types_for_diagnosis(housing_types: list[dict[str, Any]]) -> str | None:
    if not housing_types:
        return None
    chunks: list[str] = []
    for item in housing_types:
        label = item.get("type") or item.get("full_type")
        area = item.get("exclusive_area_sqm")
        count = item.get("supply_household_count")
        detail = str(label)
        if area:
            detail += f"(전용 {area}㎡"
            if count:
                detail += f", {count}세대"
            detail += ")"
        chunks.append(detail)
    return ", ".join(chunks)


def _format_schedule_lines(schedule: dict[str, str]) -> list[str]:
    labels = {
        "special_supply": "특별공급",
        "first_priority_local": "1순위 해당지역",
        "first_priority_other": "1순위 기타지역",
        "first_priority": "1순위",
        "second_priority": "2순위",
        "winner_announcement": "당첨자 발표",
        "document_submission": "서류 제출",
        "contract_period": "계약",
    }
    return [f"{label}: {schedule[key]}" for key, label in labels.items() if schedule.get(key)]


def _format_eok(value: int) -> str:
    return f"{value / 100_000_000:.2f}억".rstrip("0").rstrip(".") + "원"


def _short_housing_type(full_type: str) -> str:
    area = full_type.split(".")[0].lstrip("0") or full_type.split(".")[0]
    suffix_match = re.search(r"[A-Z]$", full_type)
    return f"{area}{suffix_match.group(0) if suffix_match else ''}"


def _find_date(text: str) -> str | None:
    match = re.search(r"([0-9]{2,4})[.년]\s*([0-9]{1,2})[.월]\s*([0-9]{1,2})", text)
    if not match:
        return None
    return _normalize_date(".".join(match.groups()))


def _normalize_date(value: str) -> str:
    parts = [part for part in re.split(r"[^0-9]+", value) if part]
    if len(parts) < 3:
        return value.strip()
    year = int(parts[0])
    if year < 100:
        year += 2000
    return f"{year:04d}.{int(parts[1]):02d}.{int(parts[2]):02d}"


def _parse_int(value: str | int | None) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    digits = re.sub(r"[^0-9]", "", value)
    return int(digits) if digits else None


def _section_after(text: str, marker: str, *, max_chars: int) -> str:
    index = text.find(marker)
    if index < 0:
        return text[:max_chars]
    return text[index:index + max_chars]


def _collect_important_lines(text: str) -> list[str]:
    keywords = [
        "입주자모집공고일",
        "입주자 모집공고일",
        "공급위치",
        "공급 위치",
        "공급규모",
        "공급 규모",
        "특별공급",
        "1순위",
        "2순위",
        "당첨자",
        "계약",
        "분양가",
        "공급금액",
        "전매",
        "거주의무",
        "재당첨",
        "소득",
        "자산",
        "무주택",
        "세대주",
        "해당지역",
        "기타지역",
    ]
    lines: list[str] = []
    seen: set[str] = set()
    for raw_line in text.replace("\r", "").split("\n"):
        line = re.sub(r"\s+", " ", raw_line).strip()
        if not line or len(line) < 8 or len(line) > 240:
            continue
        if any(keyword in line for keyword in keywords) and line not in seen:
            lines.append(line)
            seen.add(line)
        if len(lines) >= 80:
            break
    return lines
