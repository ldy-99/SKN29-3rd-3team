"""
역할: 모집공고 PDF 업로드를 받아 텍스트/표 추출 결과를 반환합니다.
흐름: Django PDFAnalyzeAPIView -> /api/pdf/analyze -> pdf_service.analyze_pdf_bytes.
"""
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.pdf_service import analyze_pdf_bytes

router = APIRouter()

MAX_PDF_BYTES = 15 * 1024 * 1024


@router.post("/pdf/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="PDF 형식의 파일만 업로드할 수 있습니다.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="업로드된 PDF 파일이 비어 있습니다.")
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF 파일은 15MB 이하만 업로드할 수 있습니다.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="PDF 파일 헤더를 확인할 수 없습니다.")

    try:
        return analyze_pdf_bytes(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
