"""
역할: 업로드된 모집공고 PDF를 저장하지 않고 텍스트/표 입력값으로 변환합니다.
흐름: pdf_router -> analyze_pdf_bytes -> pdfplumber/PyMuPDF -> React preview/전략 진단 입력.
"""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Any
from uuid import uuid4
import re

import fitz
import pdfplumber


MAX_COMBINED_TEXT_CHARS = 15_000
MAX_PREVIEW_CHARS = 2_000
MAX_TEXT_CHARS_FOR_DIAGNOSIS = 12_000
MAX_TABLES_FOR_DIAGNOSIS = 30


@dataclass
class PDFTable:
    page: int
    rows: list[list[str]]


def analyze_pdf_bytes(file_name: str, content: bytes) -> dict[str, Any]:
    """
    PDF 원본은 보관하지 않고 요청 처리 중 메모리에서만 읽습니다.
    청약홈/마이홈 PDF는 표가 많고 일부 글자가 겹쳐 찍혀 dedupe 후 추출을 기본값으로 둡니다.
    """
    warnings: list[str] = []
    text_parts: list[str] = []
    tables: list[PDFTable] = []

    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            page_count = len(pdf.pages)
            for index, page in enumerate(pdf.pages, start=1):
                working_page = page
                try:
                    working_page = page.dedupe_chars()
                except Exception as exc:
                    warnings.append(f"{index}페이지 중복 글자 제거 실패: {exc}")

                extracted_text = working_page.extract_text() or ""
                if extracted_text.strip():
                    text_parts.append(f"[page {index}]\n{extracted_text.strip()}")

                for table in working_page.extract_tables() or []:
                    normalized_rows = _normalize_table(table)
                    if normalized_rows:
                        tables.append(PDFTable(page=index, rows=normalized_rows))
    except Exception as exc:
        raise ValueError(f"PDF 텍스트 추출에 실패했습니다: {exc}") from exc

    text = _clean_text("\n\n".join(text_parts))

    if len(text) < 500:
        fallback_text, fallback_page_count = _extract_with_pymupdf(content)
        if len(fallback_text) > len(text):
            text = fallback_text
            page_count = fallback_page_count
            warnings.append("pdfplumber 추출 텍스트가 짧아 PyMuPDF fallback 결과를 사용했습니다.")

    # Node4는 자유 텍스트에서 공고 핵심 필드를 구조화하는 단계라 PDF 전문이 필요하지 않습니다.
    # 긴 공고문 전체를 넘기면 LLM 입력이 과도해져 /api/announcement 실패 가능성이 커집니다.
    diagnosis_text = text
    if len(diagnosis_text) > MAX_TEXT_CHARS_FOR_DIAGNOSIS:
        diagnosis_text = diagnosis_text[:MAX_TEXT_CHARS_FOR_DIAGNOSIS].rstrip()
        warnings.append("추출 텍스트가 길어 전략 진단에는 앞부분 중심으로 사용합니다.")

    table_text = _format_tables(tables[:MAX_TABLES_FOR_DIAGNOSIS])
    combined_text = _clean_text("\n\n".join(part for part in [diagnosis_text, table_text] if part.strip()))

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


def _format_tables(tables: list[PDFTable]) -> str:
    if not tables:
        return ""

    chunks: list[str] = ["[extracted tables]"]
    for table_index, table in enumerate(tables, start=1):
        chunks.append(f"[table {table_index} / page {table.page}]")
        chunks.extend(" | ".join(row) for row in table.rows)
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
