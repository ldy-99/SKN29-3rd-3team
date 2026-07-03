import { useNavigate } from "react-router";
import { Card, Button, WarningBox } from "../components/UI";
import { ArrowRight, CreditCard, Home, MapPin, Pencil, Timer, User } from "lucide-react";
import { ApiRequestError, api } from "../api/client";
import { useEffect, useState } from "react";

export function StrategyRun() {
  const [noticeText, setNoticeText] = useState("");
  const [isBasicOnly, setIsBasicOnly] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const navigate = useNavigate();

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
    setError("");

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 95_000);

    try {
      const result = await api.runStrategy(
        {
          announcement_text: isBasicOnly ? null : noticeText,
          profile_only: isBasicOnly,
        },
        controller.signal,
      );
      navigate(`/results/${result.strategy_id}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setError("분석 시간이 90초를 초과했습니다. 잠시 후 다시 시도해주세요.");
      } else if (error instanceof ApiRequestError && error.status === 502) {
        setError("AI 분석 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.");
      } else if (
        error instanceof ApiRequestError &&
        (error.code === "PROFILE_REQUIRED" ||
          error.code === "PROFILE_REQUIRED_FIELDS_MISSING")
      ) {
        setError("전략 진단 전에 프로필 정보를 확인하고 저장해주세요.");
      } else {
        setError(
          error instanceof Error
            ? error.message
            : "전략 진단 요청에 실패했습니다.",
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setIsRunning(false);
    }
  };

  return (
    <div className="pb-20">
      <div className="mb-9">
        <p className="mb-3 text-[13px] font-semibold tracking-[0.04em] text-[#b86a12]">
          프로필과 공고를 한 번에 분석
        </p>
        <h1 className="text-[38px] md:text-[44px] font-bold tracking-[-0.035em] leading-tight text-[#102e5a]">
          전략 진단
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[#596273]">
          프로필과 관심 공고를 바탕으로 청약 조건과 준비 전략을 확인합니다.
        </p>
      </div>

      {error && (
        <WarningBox type="error" title="API 연결 오류">
          {error}
        </WarningBox>
      )}

      {isRunning && (
        <WarningBox type="info" title="전략을 분석하고 있습니다">
          <p>
            {elapsedSeconds < 30
              ? "프로필과 공고문을 분석하고 있습니다."
              : "AI가 최종 전략을 생성하고 있습니다. 조금만 더 기다려주세요."}
          </p>
          <p className="mt-1">
            보통 30~40초 정도 걸립니다. 경과 시간: {elapsedSeconds}초
          </p>
        </WarningBox>
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
          
          <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-[#eee9df] pt-5">
            <div className="flex items-center gap-3 px-3 py-2 sm:border-r border-[#eee9df]">
              <span className="w-10 h-10 rounded-full bg-[#f8f1e5] flex items-center justify-center text-[#102e5a]">
                <CreditCard className="w-5 h-5" />
              </span>
              <div>
                <div className="text-[#7a818c] text-[12px] mb-0.5">청약통장</div>
                <div className="font-semibold text-[14px] text-[#26364e]">종합저축 · 48회</div>
              </div>
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
          <div className="mb-6">
            <div>
              <h3 className="font-bold text-[20px] mb-1.5 text-[#152846]">관심 모집공고 입력</h3>
              <p className="text-[14px] text-[#69717d]">모집공고문의 주요 내용을 복사해서 붙여넣어 주세요.</p>
            </div>
          </div>

          <textarea
            className="w-full h-[210px] bg-[#fffefa] border border-[#dcd6ca] rounded-[15px] p-5 text-[15px] text-[#26364e] placeholder:text-[#989da5] focus:outline-none focus:border-[#245ea8] focus:ring-2 focus:ring-[#245ea8]/10 resize-none transition-colors mb-5 disabled:opacity-50"
            placeholder="여기에 모집공고문을 붙여넣으세요..."
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            disabled={isBasicOnly || isRunning}
          ></textarea>

          <div className="grid grid-cols-1 sm:grid-cols-2 rounded-[15px] border border-[#e5dfd4] bg-[#fbfaf7] p-1.5 mb-5">
            <label className={`flex items-center gap-3 px-4 py-3 rounded-[11px] cursor-pointer transition-colors ${!isBasicOnly ? "bg-white shadow-sm text-[#102e5a]" : "text-[#6e7682]"}`}>
              <input
                type="radio"
                name="diagnosis-mode"
                className="accent-[#102e5a]"
                checked={!isBasicOnly}
                onChange={() => setIsBasicOnly(false)}
                disabled={isRunning}
              />
              <span className="text-[14px] font-semibold">공고문과 함께 진단</span>
            </label>
            <label className={`flex items-center gap-3 px-4 py-3 rounded-[11px] cursor-pointer transition-colors ${isBasicOnly ? "bg-white shadow-sm text-[#102e5a]" : "text-[#6e7682]"}`}>
              <input
                type="radio"
                name="diagnosis-mode"
                className="accent-[#102e5a]"
                checked={isBasicOnly}
                onChange={() => {
                  setIsBasicOnly(true);
                  setNoticeText("");
                }}
                disabled={isRunning}
              />
              <span className="text-[14px] font-semibold">공고 없이 기본 조건만 확인</span>
            </label>
          </div>

          <div className="flex items-center gap-2 mb-4 px-1 text-[13px] text-[#737b87]">
            <Timer className="w-4 h-4" />
            <span>분석에는 보통 30~40초가 걸립니다.</span>
          </div>

          <Button 
            className="w-full py-4 text-[17px] !rounded-[13px] !bg-[#102e5a] hover:!bg-[#183f75] focus:!ring-[#102e5a]"
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
