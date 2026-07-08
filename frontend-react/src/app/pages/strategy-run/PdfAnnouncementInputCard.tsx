import type { DragEventHandler, KeyboardEvent, RefObject } from "react";
import { ArrowRight, Check, FileText, Timer, Upload } from "lucide-react";
import { Button, Card, ProcessingIndicator, WarningBox } from "../../components/UI";
import type { ProgressStage } from "./progressStages";

type PdfAnnouncementInputCardProps = {
  fileInputRef: RefObject<HTMLInputElement>;
  isPdfDragging: boolean;
  isPdfUploading: boolean;
  isRunning: boolean;
  selectedPdfFile: File | null;
  pdfElapsedSeconds: number;
  elapsedSeconds: number;
  pdfStage: ProgressStage;
  runningStage: ProgressStage;
  noticeText: string;
  isBasicOnly: boolean;
  inputMethod: "manual" | "pdf";
  sourceFilename: string | null;
  pdfWarnings: string[];
  onPdfFileSelect: (file?: File | null) => void;
  onPdfDragEnter: DragEventHandler<HTMLDivElement>;
  onPdfDragOver: DragEventHandler<HTMLDivElement>;
  onPdfDragLeave: DragEventHandler<HTMLDivElement>;
  onPdfDrop: DragEventHandler<HTMLDivElement>;
  onNoticeTextChange: (value: string) => void;
  onBasicOnlyChange: (checked: boolean) => void;
  onRun: () => void;
};

export function PdfAnnouncementInputCard({
  fileInputRef,
  isPdfDragging,
  isPdfUploading,
  isRunning,
  selectedPdfFile,
  pdfElapsedSeconds,
  elapsedSeconds,
  pdfStage,
  runningStage,
  noticeText,
  isBasicOnly,
  inputMethod,
  sourceFilename,
  pdfWarnings,
  onPdfFileSelect,
  onPdfDragEnter,
  onPdfDragOver,
  onPdfDragLeave,
  onPdfDrop,
  onNoticeTextChange,
  onBasicOnlyChange,
  onRun,
}: PdfAnnouncementInputCardProps) {
  return (
    <Card
      className={`relative p-7 !rounded-[20px] !shadow-[0_10px_32px_rgba(35,45,60,0.05)] ${
        isPdfDragging
          ? "!border-[#0b5bd3] !ring-4 !ring-[#0b5bd3]/10"
          : "!border-[#e6e0d6]"
      }`}
      onDragEnter={onPdfDragEnter}
      onDragOver={onPdfDragOver}
      onDragLeave={onPdfDragLeave}
      onDrop={onPdfDrop}
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
          onPdfFileSelect(event.target.files?.[0]);
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
          <PdfUploadPrompt onOpenFileDialog={() => fileInputRef.current?.click()} />

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

          {pdfWarnings.length > 0 && (
            <WarningBox type="warning" title="PDF 분석 확인 필요" className="mb-4">
              <ul className="list-disc pl-5">
                {pdfWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </WarningBox>
          )}

          <textarea
            className="w-full h-[210px] bg-[#fffefa] border border-[#dcd6ca] rounded-[15px] p-5 text-[15px] text-[#26364e] placeholder:text-[#989da5] focus:outline-none focus:border-[#245ea8] focus:ring-2 focus:ring-[#245ea8]/10 resize-none transition-colors mb-5 disabled:opacity-50"
            placeholder="아파트 분양 입주자모집공고를 여기에 붙여넣으세요..."
            value={noticeText}
            onChange={(e) => onNoticeTextChange(e.target.value)}
            disabled={isBasicOnly}
          />

          <label className="flex items-center gap-3 mb-8 cursor-pointer group">
            <span className="relative flex items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isBasicOnly}
                onChange={(event) => onBasicOnlyChange(event.target.checked)}
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
            onClick={onRun}
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
  );
}

function PdfUploadPrompt({ onOpenFileDialog }: { onOpenFileDialog: () => void }) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenFileDialog();
    }
  };

  return (
    <div
      className="mb-5 cursor-pointer rounded-[16px] border border-dashed border-[#cfd8e6] bg-[#f8fbff] px-5 py-4 transition-colors hover:border-[#245ea8]/50"
      role="button"
      tabIndex={0}
      onClick={onOpenFileDialog}
      onKeyDown={handleKeyDown}
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
  );
}
