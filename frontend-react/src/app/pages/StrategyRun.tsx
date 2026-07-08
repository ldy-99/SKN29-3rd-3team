// 역할: 기본 프로필 진단, 수동 공고문, PDF 정리본 기반 전략 진단을 실행하는 화면입니다.
// 흐름: StrategyRun.tsx -> api.runStrategy -> Django StrategyRunAPIView -> FastAPI pipeline.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useLocation, useNavigate } from "react-router";
import { PageTitle, ErrorNotice, WarningBox } from "../components/UI";
import { api } from "../api/client";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { PdfAnnouncementInputCard } from "./strategy-run/PdfAnnouncementInputCard";
import { getPdfUploadStage, getStrategyRunningStage } from "./strategy-run/progressStages";
import { StrategyProfileSummary } from "./strategy-run/StrategyProfileSummary";

const STRATEGY_DRAFT_STORAGE_KEY = "strategy-run-draft-v1";

type StrategyDraft = {
  noticeText: string;
  isBasicOnly: boolean;
  inputMethod: "manual" | "pdf";
  sourceFilename: string | null;
  pdfAnalysisId: string | null;
  pdfSummaryText: string | null;
  pdfExtractedFields: Record<string, unknown> | null;
  pdfWarnings: string[];
};

export function StrategyRun() {
  const [initialDraft] = useState(() => readStrategyDraft());
  const [noticeText, setNoticeText] = useState(initialDraft?.noticeText ?? "");
  const [isBasicOnly, setIsBasicOnly] = useState(initialDraft?.isBasicOnly ?? false);
  const [isRunning, setIsRunning] = useState(false);
  const [isPdfUploading, setIsPdfUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pdfElapsedSeconds, setPdfElapsedSeconds] = useState(0);
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const [inputMethod, setInputMethod] = useState<"manual" | "pdf">(initialDraft?.inputMethod ?? "manual");
  const [sourceFilename, setSourceFilename] = useState<string | null>(initialDraft?.sourceFilename ?? null);
  const [pdfAnalysisId, setPdfAnalysisId] = useState<string | null>(initialDraft?.pdfAnalysisId ?? null);
  const [pdfSummaryText, setPdfSummaryText] = useState<string | null>(initialDraft?.pdfSummaryText ?? null);
  const [pdfExtractedFields, setPdfExtractedFields] = useState<Record<string, unknown> | null>(
    initialDraft?.pdfExtractedFields ?? null,
  );
  const [pdfWarnings, setPdfWarnings] = useState<string[]>(initialDraft?.pdfWarnings ?? []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDragDepthRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const runningStage = getStrategyRunningStage(elapsedSeconds);
  const pdfStage = getPdfUploadStage(pdfElapsedSeconds);
  const isBusy = isRunning || isPdfUploading;

  const applyDraft = useCallback((draft: StrategyDraft) => {
    setNoticeText(draft.noticeText);
    setIsBasicOnly(draft.isBasicOnly);
    setInputMethod(draft.inputMethod);
    setSourceFilename(draft.sourceFilename);
    setPdfAnalysisId(draft.pdfAnalysisId);
    setPdfSummaryText(draft.pdfSummaryText);
    setPdfExtractedFields(draft.pdfExtractedFields);
    setPdfWarnings(draft.pdfWarnings);
    writeStrategyDraft(draft);
  }, []);

  useEffect(() => {
    // PdfAnalysis에서 전달한 정리본을 기존 수동 공고문 입력 흐름에 태웁니다.
    const state = location.state as
      | {
          announcementText?: string;
          sourceFilename?: string;
          inputMethod?: string;
          pdfAnalysisId?: string;
          pdfSummaryText?: string;
          pdfExtractedFields?: Record<string, unknown>;
          pdfWarnings?: string[];
        }
      | null;

    if (state?.announcementText) {
      applyDraft({
        noticeText: state.announcementText,
        isBasicOnly: false,
        inputMethod: state.inputMethod === "pdf" ? "pdf" : "manual",
        sourceFilename: state.sourceFilename ?? null,
        pdfAnalysisId: state.pdfAnalysisId ?? null,
        pdfSummaryText: state.pdfSummaryText ?? null,
        pdfExtractedFields: state.pdfExtractedFields ?? null,
        pdfWarnings: state.pdfWarnings ?? [],
      });
      window.history.replaceState({}, document.title);
    }
  }, [applyDraft, location.state]);

  useEffect(() => {
    writeStrategyDraft({
      noticeText,
      isBasicOnly,
      inputMethod,
      sourceFilename,
      pdfAnalysisId,
      pdfSummaryText,
      pdfExtractedFields,
      pdfWarnings,
    });
  }, [noticeText, isBasicOnly, inputMethod, sourceFilename, pdfAnalysisId, pdfSummaryText, pdfExtractedFields, pdfWarnings]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!isPdfUploading) return;

    const timer = window.setInterval(() => {
      setPdfElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isPdfUploading]);

  const clearAnnouncementDraft = () => {
    applyDraft({
      noticeText: "",
      isBasicOnly: true,
      inputMethod: "manual",
      sourceFilename: null,
      pdfAnalysisId: null,
      pdfSummaryText: null,
      pdfExtractedFields: null,
      pdfWarnings: [],
    });
  };

  const handlePdfFileSelect = async (file?: File | null) => {
    if (!file || isBusy) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    setSelectedPdfFile(file);
    setIsPdfUploading(true);
    setPdfElapsedSeconds(0);
    setError(null);

    try {
      const data = await api.analyzePdf(file);
      applyDraft({
        noticeText: data.diagnosis_text || data.summary_text || data.combined_text || "",
        isBasicOnly: false,
        inputMethod: "pdf",
        sourceFilename: data.filename,
        pdfAnalysisId: data.pdf_analysis_id,
        pdfSummaryText: data.summary_text ?? null,
        pdfExtractedFields: data.extracted_fields ?? null,
        pdfWarnings: data.warnings ?? [],
      });
    } catch (error) {
      setError(error);
    } finally {
      setIsPdfUploading(false);
    }
  };

  const isPdfFileDrag = (event: DragEvent<HTMLDivElement>) => Array.from(event.dataTransfer.types).includes("Files");

  const handlePdfDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!isPdfFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isBusy ? "none" : "copy";
    if (isBusy) return;
    pdfDragDepthRef.current += 1;
    setIsPdfDragging(true);
  };

  const handlePdfDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    pdfDragDepthRef.current = 0;
    setIsPdfDragging(false);
    if (isBusy) return;
    void handlePdfFileSelect(event.dataTransfer.files?.[0]);
  };

  const handlePdfDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isPdfFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = isBusy ? "none" : "copy";
  };

  const handlePdfDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isPdfDragging && !isPdfFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    pdfDragDepthRef.current = Math.max(pdfDragDepthRef.current - 1, 0);
    if (pdfDragDepthRef.current === 0) {
      setIsPdfDragging(false);
    }
  };

  const handleRun = async () => {
    if (isBusy) return;

    setElapsedSeconds(0);
    setIsRunning(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 95_000);

    try {
      // Django는 이 요청을 profile -> simulate -> announcement 순서로 FastAPI에 proxy합니다.
      const result = await api.runStrategy(
        {
          announcement_text: isBasicOnly ? null : noticeText,
          profile_only: isBasicOnly,
          input_method: isBasicOnly ? null : inputMethod,
          source_filename: isBasicOnly ? null : sourceFilename,
          pdf_analysis_id: isBasicOnly ? null : pdfAnalysisId,
          pdf_summary_text: isBasicOnly ? null : pdfSummaryText,
          pdf_extracted_fields: isBasicOnly ? null : pdfExtractedFields,
        },
        controller.signal,
      );
      clearStrategyDraft();
      navigate(`/results/${result.strategy_id}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("분석 시간이 90초를 초과했습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError(error);
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsRunning(false);
    }
  };

  return (
    <div className="pb-20">
      <PageTitle
        title="아파트 분양 청약 진단"
        description="프로필과 아파트 입주자모집공고를 바탕으로 청약 조건을 분석합니다."
      />

      {!isBusy && (
        <WarningBox type="info" title="현재 지원 범위">
          민영·공공 아파트 분양 청약을 지원합니다. 오피스텔, 임대주택, 토지 및 상가 청약은 추후 지원 예정입니다.
        </WarningBox>
      )}

      <ErrorNotice error={error} fallbackMessage="전략 진단 요청에 실패했습니다." />

      <div className="space-y-6">
        <StrategyProfileSummary isBusy={isBusy} onEditProfile={() => navigate("/profile")} />

        <PdfAnnouncementInputCard
          fileInputRef={fileInputRef}
          isPdfDragging={isPdfDragging}
          isPdfUploading={isPdfUploading}
          isRunning={isRunning}
          selectedPdfFile={selectedPdfFile}
          pdfElapsedSeconds={pdfElapsedSeconds}
          elapsedSeconds={elapsedSeconds}
          pdfStage={pdfStage}
          runningStage={runningStage}
          noticeText={noticeText}
          isBasicOnly={isBasicOnly}
          inputMethod={inputMethod}
          sourceFilename={sourceFilename}
          pdfWarnings={pdfWarnings}
          onPdfFileSelect={(file) => void handlePdfFileSelect(file)}
          onPdfDragEnter={handlePdfDragEnter}
          onPdfDragOver={handlePdfDragOver}
          onPdfDragLeave={handlePdfDragLeave}
          onPdfDrop={handlePdfDrop}
          onNoticeTextChange={setNoticeText}
          onBasicOnlyChange={(checked) => {
            setIsBasicOnly(checked);
            if (checked) {
              clearAnnouncementDraft();
            }
          }}
          onRun={handleRun}
        />
      </div>
    </div>
  );
}

function readStrategyDraft(): StrategyDraft | null {
  try {
    const stored = sessionStorage.getItem(STRATEGY_DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StrategyDraft>;
    return {
      noticeText: typeof parsed.noticeText === "string" ? parsed.noticeText : "",
      isBasicOnly: parsed.isBasicOnly === true,
      inputMethod: parsed.inputMethod === "pdf" ? "pdf" : "manual",
      sourceFilename: typeof parsed.sourceFilename === "string" ? parsed.sourceFilename : null,
      pdfAnalysisId: typeof parsed.pdfAnalysisId === "string" ? parsed.pdfAnalysisId : null,
      pdfSummaryText: typeof parsed.pdfSummaryText === "string" ? parsed.pdfSummaryText : null,
      pdfExtractedFields:
        parsed.pdfExtractedFields && typeof parsed.pdfExtractedFields === "object" && !Array.isArray(parsed.pdfExtractedFields)
          ? parsed.pdfExtractedFields as Record<string, unknown>
          : null,
      pdfWarnings: Array.isArray(parsed.pdfWarnings)
        ? parsed.pdfWarnings.filter((warning): warning is string => typeof warning === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function writeStrategyDraft(draft: StrategyDraft) {
  try {
    sessionStorage.setItem(STRATEGY_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 진단 실행 흐름은 계속 유지합니다.
  }
}

function clearStrategyDraft() {
  try {
    sessionStorage.removeItem(STRATEGY_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
