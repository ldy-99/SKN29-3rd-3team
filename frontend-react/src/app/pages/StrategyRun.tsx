// 역할: 기본 프로필 진단 또는 수동 공고문 기반 전략 진단을 실행하는 화면입니다.
// 흐름: StrategyRun.tsx -> api.runStrategy -> Django StrategyRunAPIView -> FastAPI pipeline.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useLocation, useNavigate } from "react-router";
import { Card, PageTitle, Button, ErrorNotice, ProcessingIndicator, WarningBox } from "../components/UI";
import { ArrowRight, Check, FileText, Home, MapPin, Pencil, Timer, User } from "lucide-react";
import { api } from "../api/client";
import { useEffect, useState } from "react";

export function StrategyRun() {
  const [noticeText, setNoticeText] = useState("");
  const [isBasicOnly, setIsBasicOnly] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputMethod, setInputMethod] = useState<"manual" | "pdf">("manual");
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // PdfAnalysis에서 전달한 combined_text를 기존 수동 공고문 입력 흐름에 태웁니다.
    const state = location.state as
      | { announcementText?: string; sourceFilename?: string; inputMethod?: string }
      | null;

    if (state?.announcementText) {
      setNoticeText(state.announcementText);
      setIsBasicOnly(false);
      setInputMethod(state.inputMethod === "pdf" ? "pdf" : "manual");
      setSourceFilename(state.sourceFilename ?? null);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const handleRun = async () => {
    if (isRunning) return;

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
        },
        controller.signal,
      );
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

      <WarningBox type="info" title="현재 지원 범위">
        민영·공공 아파트 분양 청약을 지원합니다. 오피스텔, 임대주택, 토지 및 상가 청약은 추후 지원 예정입니다.
      </WarningBox>

      <ErrorNotice error={error} fallbackMessage="전략 진단 요청에 실패했습니다." />

      {isRunning && (
        <ProcessingIndicator
          title={
            elapsedSeconds < 12
              ? "입력 정보를 확인하고 있습니다"
              : elapsedSeconds < 30
                ? "청약 조건과 공급 유형을 비교하고 있습니다"
                : "맞춤 전략을 생성하고 있습니다"
          }
          description={
            isBasicOnly
              ? "저장된 프로필을 기준으로 신청 가능성이 높은 공급 유형을 분석합니다."
              : "프로필과 입력한 모집공고를 함께 분석해 맞춤 전략을 정리합니다."
          }
          elapsedSeconds={elapsedSeconds}
          steps={["입력 정보 확인", "조건 비교", "전략 생성"]}
          currentStep={elapsedSeconds < 12 ? 0 : elapsedSeconds < 30 ? 1 : 2}
        />
      )}

      <div className="space-y-6">
        <Card className="p-7 !rounded-[20px] !border-[#e6e0d6] !shadow-[0_10px_32px_rgba(35,45,60,0.05)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-[18px] flex items-center gap-2 text-[#152846]">
              <User className="w-5 h-5 text-[#b86a12]" />
              현재 기준 프로필
            </h3>
            <button
              onClick={() => navigate("/profile")}
              disabled={isRunning}
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

        <Card className="p-7 !rounded-[20px] !border-[#e6e0d6] !shadow-[0_10px_32px_rgba(35,45,60,0.05)]">
          <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-[20px] mb-1.5 text-[#152846]">아파트 분양 모집공고 입력</h3>
              <p className="text-[14px] text-[#69717d]">아파트 입주자모집공고의 주요 내용을 복사해서 붙여넣어 주세요.</p>
            </div>
            <Button
              variant="outline"
              className="text-[13px] py-2 px-4 h-auto shrink-0"
              onClick={() => navigate("/pdf")}
              disabled={isRunning}
            >
              PDF 파일로 분석하기
            </Button>
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
            disabled={isBasicOnly || isRunning}
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
                    setNoticeText("");
                    setInputMethod("manual");
                    setSourceFilename(null);
                  }
                }}
                disabled={isRunning}
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
            disabled={isRunning || (!isBasicOnly && noticeText.trim() === "")}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <SpinnerIcon className="w-5 h-5 animate-spin" />
                분석 중...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                진단 실행
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </Card>
      </div>
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}
