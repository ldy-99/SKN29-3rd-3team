// 역할: 기본 프로필 진단, 수동 공고문, PDF 정리본 기반 전략 진단을 실행하는 화면입니다.
// 흐름: StrategyRun.tsx -> api.runStrategy -> Django StrategyRunAPIView -> FastAPI pipeline.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useLocation, useNavigate } from "react-router";
import { Card, PageTitle, Button, ErrorNotice, ProcessingIndicator, WarningBox } from "../components/UI";
import { ArrowRight, Check, FileText, Home, MapPin, Pencil, Timer, Upload, User } from "lucide-react";
import { api } from "../api/client";
import { useEffect, useRef, useState, type DragEvent } from "react";

const STRATEGY_DRAFT_STORAGE_KEY = "strategy-run-draft-v1";

type StrategyDraft = {
  noticeText: string;
  isBasicOnly: boolean;
  inputMethod: "manual" | "pdf";
  sourceFilename: string | null;
  pdfAnalysisId: string | null;
  pdfSummaryText: string | null;
  pdfExtractedFields: Record<string, unknown> | null;
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfDragDepthRef = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();
  const runningStage = getStrategyRunningStage(elapsedSeconds);
  const pdfStage = getPdfUploadStage(pdfElapsedSeconds);
  const isBusy = isRunning || isPdfUploading;

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
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    writeStrategyDraft({
      noticeText,
      isBasicOnly,
      inputMethod,
      sourceFilename,
      pdfAnalysisId,
      pdfSummaryText,
      pdfExtractedFields,
    });
  }, [noticeText, isBasicOnly, inputMethod, sourceFilename, pdfAnalysisId, pdfSummaryText, pdfExtractedFields]);

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

  const applyDraft = (draft: StrategyDraft) => {
    setNoticeText(draft.noticeText);
    setIsBasicOnly(draft.isBasicOnly);
    setInputMethod(draft.inputMethod);
    setSourceFilename(draft.sourceFilename);
    setPdfAnalysisId(draft.pdfAnalysisId);
    setPdfSummaryText(draft.pdfSummaryText);
    setPdfExtractedFields(draft.pdfExtractedFields);
    writeStrategyDraft(draft);
  };

  const clearAnnouncementDraft = () => {
    applyDraft({
      noticeText: "",
      isBasicOnly: true,
      inputMethod: "manual",
      sourceFilename: null,
      pdfAnalysisId: null,
      pdfSummaryText: null,
      pdfExtractedFields: null,
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
        <Card className="p-7 !rounded-[20px] !border-[#e6e0d6] !shadow-[0_10px_32px_rgba(35,45,60,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[18px] flex items-center gap-2 text-[#152846]">
              <User className="w-5 h-5 text-[#b86a12]" />
              현재 기준 프로필
            </h3>
            <button
              onClick={() => navigate("/profile")}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0b5bd3] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              <Pencil className="w-4 h-4" />
              수정하기
            </button>
          </div>

          <div className="bg-[#f5f5f7] rounded-[16px] p-5 flex flex-wrap gap-x-8 gap-y-4 text-[14px]">
            <div>
              <div className="text-[#6e6e73] mb-1">통장 유형</div>
              <div className="font-medium">종합저축 (4년, 600만)</div>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 sm:border-r border-[#eee9df]">
              <span className="w-10 h-10 rounded-full bg-[#f8f1e5] flex items-center justify-center text-[#102e5a]">
                <MapPin className="w-5 h-5" />
              </span>
              <div>
                <div className="text-[#7a818c] text-[12px] mb-0.5">거주·세대</div>
                <div className="font-semibold text-[14px] text-[#26364e]">서울 · 세대주</div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-3 py-2">
              <span className="w-10 h-10 rounded-full bg-[#f8f1e5] flex items-center justify-center text-[#102e5a]">
                <Home className="w-5 h-5" />
              </span>
              <div>
                <div className="text-[#7a818c] text-[12px] mb-0.5">주택 소유</div>
                <div className="font-semibold text-[14px] text-[#26364e]">무주택 · 5년</div>
              </div>
            </div>
          </div>
        </Card>

        <Card
          className={`relative p-7 !rounded-[20px] !shadow-[0_10px_32px_rgba(35,45,60,0.05)] ${
            isPdfDragging
              ? "!border-[#0b5bd3] !ring-4 !ring-[#0b5bd3]/10"
              : "!border-[#e6e0d6]"
          }`}
          onDragEnter={handlePdfDragEnter}
          onDragOver={handlePdfDragOver}
          onDragLeave={handlePdfDragLeave}
          onDrop={handlePdfDrop}
        >
          {isPdfDragging && (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[18px] border-2 border-dashed border-[#0b5bd3] bg-[#f4f8ff]/95 text-center shadow-[inset_0_0_0_1px_rgba(11,91,211,0.06)]">
              <div>
                <Upload className="mx-auto mb-3 h-8 w-8 text-[#0b5bd3]" />
                <p className="text-[18px] font-bold text-[#102e5a]">여기에 PDF를 드롭하세요</p>
                <p className="mt-1 text-[13px] text-[#68717d]">아파트 입주자모집공고 PDF를 바로 분석합니다.</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              void handlePdfFileSelect(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-[20px] mb-1.5 text-[#152846]">아파트 분양 모집공고 입력</h3>
              <p className="text-[14px] text-[#69717d]">아파트 입주자모집공고의 주요 내용을 붙여넣거나 PDF로 바로 분석하세요.</p>
            </div>
          </div>

          {isPdfUploading ? (
            <ProcessingIndicator
              title={pdfStage.title}
              description={`${selectedPdfFile?.name ?? "선택한 PDF"}의 공고문 내용을 진단에 사용할 수 있도록 변환합니다.`}
              elapsedSeconds={pdfElapsedSeconds}
              steps={["파일 확인", "내용 추출", "결과 정리"]}
              currentStep={pdfStage.currentStep}
              progressPercent={pdfStage.progressPercent}
              showProgress
              className="!mb-0"
            />
          ) : isRunning ? (
            <ProcessingIndicator
              title={runningStage.title}
              description={
                isBasicOnly
                  ? "저장된 프로필을 기준으로 신청 가능성이 높은 공급 유형을 분석합니다."
                  : "프로필과 입력한 모집공고를 함께 분석해 맞춤 전략을 정리합니다."
              }
              elapsedSeconds={elapsedSeconds}
              steps={["프로필 확인", "공고 조건 비교", "전략 정리"]}
              currentStep={runningStage.currentStep}
              progressPercent={runningStage.progressPercent}
              showProgress
              className="!mb-0"
            />
          ) : (
            <>
              <div
                className="mb-5 cursor-pointer rounded-[16px] border border-dashed border-[#cfd8e6] bg-[#f8fbff] px-5 py-4 transition-colors hover:border-[#245ea8]/50"
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={handlePdfDragEnter}
                onDragOver={handlePdfDragOver}
                onDragLeave={handlePdfDragLeave}
                onDrop={handlePdfDrop}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#245ea8] shadow-sm">
                    <Upload className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#26364e]">PDF를 여기에 드래그하거나 클릭해서 선택하세요</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#737b87]">
                      분석 후 정리본이 아래 입력창에 채워지고, 다른 탭에 다녀와도 현재 브라우저 탭에서는 유지됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {noticeText && !isBasicOnly && (
                <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-[#007aff]/10 px-4 py-3 text-[13px] text-[#1d1d1f]">
                  <FileText className="w-4 h-4 text-[#007aff] shrink-0" />
                  <span>
                    {inputMethod === "pdf"
                      ? `${sourceFilename ?? "PDF"} 추출 텍스트가 진단 입력에 준비되어 있습니다.`
                      : "수동 입력 공고문이 진단 입력에 준비되어 있습니다."}
                  </span>
                </div>
              )}

              <textarea
                className="w-full h-[210px] bg-[#fffefa] border border-[#dcd6ca] rounded-[15px] p-5 text-[15px] text-[#26364e] placeholder:text-[#989da5] focus:outline-none focus:border-[#245ea8] focus:ring-2 focus:ring-[#245ea8]/10 resize-none transition-colors mb-5 disabled:opacity-50"
                placeholder="아파트 분양 입주자모집공고를 여기에 붙여넣으세요..."
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                disabled={isBasicOnly}
              ></textarea>

              <label className="flex items-center gap-3 mb-8 cursor-pointer group">
                <span className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isBasicOnly}
                    onChange={(e) => {
                      setIsBasicOnly(e.target.checked);
                      if (e.target.checked) {
                        clearAnnouncementDraft();
                      }
                    }}
                  />
                  <span className="w-6 h-6 rounded-[8px] border-2 border-[#dcd6ca] peer-checked:bg-[#102e5a] peer-checked:border-[#102e5a] transition-colors flex items-center justify-center group-hover:border-[#102e5a]/60">
                    <Check className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100" />
                  </span>
                </span>
                <span className="text-[14px] font-semibold select-none">공고 없이 기본 조건만 확인</span>
              </label>

              <div className="flex items-center gap-2 mb-4 px-1 text-[13px] text-[#737b87]">
                <Timer className="w-4 h-4" />
                <span>분석에는 보통 30~40초가 걸립니다.</span>
              </div>

              <Button
                className="w-full py-4 text-[17px]"
                onClick={handleRun}
                disabled={!isBasicOnly && noticeText.trim() === ""}
              >
                <span className="flex items-center justify-center gap-2">
                  진단 실행
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function getPdfUploadStage(elapsedSeconds: number) {
  // Backend progress events are not exposed yet, so the bar is an elapsed-time estimate per visible stage.
  if (elapsedSeconds < 5) {
    return {
      title: "PDF 파일을 확인하고 있습니다",
      currentStep: 0,
      progressPercent: Math.min(12 + elapsedSeconds * 4, 32),
    };
  }

  if (elapsedSeconds < 28) {
    return {
      title: "본문과 표를 추출하고 있습니다",
      currentStep: 1,
      progressPercent: Math.min(35 + (elapsedSeconds - 5) * 2, 84),
    };
  }

  return {
    title: "추출 결과를 정리하고 있습니다",
    currentStep: 2,
    progressPercent: Math.min(86 + Math.floor((elapsedSeconds - 28) * 0.5), 96),
  };
}

function getStrategyRunningStage(elapsedSeconds: number) {
  if (elapsedSeconds < 10) {
    return {
      title: "프로필과 입력 정보를 확인하고 있습니다",
      currentStep: 0,
      progressPercent: Math.min(15 + elapsedSeconds * 3, 42),
    };
  }

  if (elapsedSeconds < 35) {
    return {
      title: "청약 조건과 공급 유형을 비교하고 있습니다",
      currentStep: 1,
      progressPercent: Math.min(45 + (elapsedSeconds - 10) * 1.5, 82),
    };
  }

  return {
    title: "맞춤 전략을 생성하고 있습니다",
    currentStep: 2,
    progressPercent: Math.min(84 + Math.floor((elapsedSeconds - 35) * 0.4), 96),
  };
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
