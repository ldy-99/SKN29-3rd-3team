// 역할: 모집공고 PDF 업로드 화면입니다.
// 흐름: PdfAnalysis.tsx -> api.analyzePdf -> Django PDFAnalyzeAPIView -> FastAPI /api/pdf/analyze.
// 추출된 원본 PDF는 저장하지 않고 combined_text만 전략 진단 입력으로 넘깁니다.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Card, PageTitle, Button, ErrorNotice, ProcessingIndicator, SettingsList, WarningBox } from "../components/UI";
import { ArrowRight, FileText, Upload } from "lucide-react";
import { api } from "../api/client";

type PdfAnalysisResult = {
  pdf_analysis_id: string;
  extraction_status: string;
  filename: string;
  page_count: number;
  text_length: number;
  combined_text_length: number;
  table_count: number;
  truncated: boolean;
  preview: string;
  combined_text: string;
  warnings: string[];
};

export function PdfAnalysis() {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<PdfAnalysisResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isUploading) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isUploading]);

  const handleFileChange = async (file?: File | null) => {
    // 선택 즉시 Django proxy를 통해 FastAPI PDF 추출 endpoint까지 왕복합니다.
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    setSelectedFile(file);
    setIsUploading(true);
    setElapsedSeconds(0);
    setError(null);
    setResult(null);

    try {
      const data = await api.analyzePdf(file);
      setResult(data);
    } catch (error) {
      setError(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUseForStrategy = () => {
    if (!result?.combined_text) return;

    // PDF 원본이 아니라 추출된 진단용 텍스트만 StrategyRun 화면 state로 넘깁니다.
    navigate("/strategy", {
      state: {
        announcementText: result.combined_text,
        sourceFilename: result.filename,
        inputMethod: "pdf",
      },
    });
  };

  return (
    <div className="pb-20">
      <PageTitle
        title="PDF 공고문 분석"
        description="모집공고문에서 텍스트와 표를 추출해 전략 진단 입력으로 사용합니다."
      />

      <div className="mb-6 text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-4 rounded-[16px]">
        PDF 원본은 저장하지 않습니다. 추출된 텍스트를 확인한 뒤 전략 진단 입력으로 넘깁니다.
      </div>

      <ErrorNotice error={error} fallbackMessage="PDF 분석 요청에 실패했습니다." />

      <div className="space-y-8">
        <Card className={`p-6 sm:p-10 border-2 border-dashed flex flex-col items-center justify-center text-center min-h-[300px] transition-colors group ${
          isUploading ? "border-[#007aff]/30 bg-[#007aff]/5 cursor-wait" : "border-[#e5e5e7] hover:border-[#007aff]/50 hover:bg-[#f5f5f7] cursor-pointer"
        }`} onClick={!isUploading ? () => fileInputRef.current?.click() : undefined}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => handleFileChange(event.target.files?.[0])}
          />
          {isUploading ? (
            <ProcessingIndicator
              title={
                elapsedSeconds < 8
                  ? "PDF 파일을 확인하고 있습니다"
                  : elapsedSeconds < 22
                    ? "본문과 표를 추출하고 있습니다"
                    : "추출 결과를 정리하고 있습니다"
              }
              description={`${selectedFile?.name ?? "선택한 PDF"}의 공고문 내용을 진단에 사용할 수 있도록 변환합니다.`}
              elapsedSeconds={elapsedSeconds}
              steps={["파일 확인", "내용 추출", "결과 정리"]}
              currentStep={elapsedSeconds < 8 ? 0 : elapsedSeconds < 22 ? 1 : 2}
              className="!mb-0 w-full max-w-[620px] text-left"
            />
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4 text-[#6e6e73] group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-[17px] font-semibold mb-2">PDF 파일 업로드</h3>
              <p className="text-[14px] text-[#6e6e73] mb-6">
                {selectedFile ? selectedFile.name : "클릭하여 청약홈/마이홈 모집공고 PDF를 선택하세요."}
              </p>
              <Button variant="outline" className="pointer-events-none">
                파일 선택
              </Button>
            </>
          )}
        </Card>

        {result && (
          <div>
            <div className="flex items-center justify-between px-2 mb-4">
              <h3 className="text-[20px] font-bold">추출 결과</h3>
              {result.warnings?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#ff9f0a] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#ff9f0a]"></span>
                  확인 필요
                </div>
              )}
            </div>

            <SettingsList>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">파일명</span>
                <span className="font-semibold text-[15px] text-right break-all">{result.filename}</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">페이지</span>
                <span className="font-semibold text-[15px]">{result.page_count}쪽</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">추출 표</span>
                <span className="font-semibold text-[15px]">{result.table_count}개</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">진단 입력 길이</span>
                <span className="font-semibold text-[15px]">{result.combined_text_length.toLocaleString()}자</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-[#6e6e73] text-[15px]">상태</span>
                <span className="font-semibold text-[15px]">{result.extraction_status}</span>
              </div>
            </SettingsList>

            {result.warnings?.length > 0 && (
              <WarningBox type="warning" title="확인 필요" className="mt-6">
                <ul className="list-disc pl-5">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </WarningBox>
            )}

            <Card className="mt-6 p-6">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-[#007aff]" />
                <h4 className="font-semibold text-[17px]">미리보기</h4>
              </div>
              <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words bg-[#f5f5f7] rounded-[16px] p-4 text-[13px] leading-relaxed text-[#1d1d1f]">
                {result.preview || "추출된 텍스트가 없습니다."}
              </pre>
            </Card>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                다른 파일 선택
              </Button>
              <Button onClick={handleUseForStrategy} disabled={!result.combined_text}>
                <span className="flex items-center gap-2">
                  전략 진단에 사용
                  <ArrowRight className="w-5 h-5" />
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
