import { useState } from "react";
import { Card, PageTitle, ApiBadge, Button, SettingsList, WarningBox } from "../components/UI";
import { Upload } from "lucide-react";
import { api } from "../api/client";

export function PdfAnalysis() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    setIsUploading(true);
    setError("");

    try {
      const data = await api.analyzePdf();
      setResult(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : "PDF 분석 요청에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="pb-20">
      <ApiBadge method="POST" endpoint="/api/pdf/analyze" />
      
      <PageTitle 
        title="PDF 공고문 분석" 
        description="모집공고문 파일을 업로드하면 핵심 정보를 깔끔하게 정리해 드립니다." 
      />

      <div className="mb-6 text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-4 rounded-[16px]">
        추출된 정보는 사용자가 확인하기 전까지는 자동 진단에 반영되지 않습니다.
      </div>

      {error && (
        <WarningBox type="error" title="API 연결 오류">
          {error}
        </WarningBox>
      )}

      <div className="space-y-8">
        <Card className={`p-10 border-2 border-dashed flex flex-col items-center justify-center text-center h-[300px] transition-colors cursor-pointer group ${
          isUploading ? "border-[#007aff]/30 bg-[#007aff]/5" : "border-[#e5e5e7] hover:border-[#007aff]/50 hover:bg-[#f5f5f7]"
        }`} onClick={!isUploading ? handleUpload : undefined}>
          {isUploading ? (
            <>
              <div className="w-12 h-12 rounded-full border-4 border-[#e5e5e7] border-t-[#007aff] animate-spin mb-4"></div>
              <h3 className="text-[17px] font-semibold mb-2">분석 중...</h3>
              <p className="text-[14px] text-[#6e6e73]">PDF 내용을 읽고 있습니다.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-[#f5f5f7] flex items-center justify-center mb-4 text-[#6e6e73] group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-[17px] font-semibold mb-2">PDF 파일 업로드</h3>
              <p className="text-[14px] text-[#6e6e73] mb-6">파일을 드래그하거나 클릭하여 선택하세요.</p>
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
              {result.needs_review?.length > 0 && (
                <div className="flex items-center gap-1.5 text-[13px] text-[#ff9f0a] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#ff9f0a]"></span>
                  확인 필요
                </div>
              )}
            </div>
            
            <SettingsList>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">공급 위치</span>
                <span className="font-semibold text-[15px]">{result.extracted.region}</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">공급 유형</span>
                <span className="font-semibold text-[15px]">{result.extracted.supply_category}</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">주택형</span>
                <span className="font-semibold text-[15px]">{result.extracted.area_text}</span>
              </div>
              <div className="py-3 flex justify-between border-b border-[#e5e5e7]">
                <span className="text-[#6e6e73] text-[15px]">분양가 범위</span>
                <span className="font-semibold text-[15px]">{result.extracted.sale_price_krw?.toLocaleString()}원</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-[#6e6e73] text-[15px]">청약 일정</span>
                <span className="font-semibold text-[15px]">{result.extracted.application_start_date} ~ {result.extracted.application_end_date}</span>
              </div>
            </SettingsList>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline">내용 수정</Button>
              <Button>확인 및 수락</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
