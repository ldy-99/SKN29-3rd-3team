// 역할: 기본 프로필 진단 또는 수동 공고문 기반 전략 진단을 실행하는 화면입니다.
// 흐름: StrategyRun.tsx -> api.runStrategy -> Django StrategyRunAPIView -> FastAPI pipeline.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useLocation, useNavigate } from "react-router";
import { Card, PageTitle, ApiBadge, Button, WarningBox } from "../components/UI";
import { ArrowRight, FileText, User } from "lucide-react";
import { ApiRequestError, api } from "../api/client";
import { useEffect, useState } from "react";

export function StrategyRun() {
  const [noticeText, setNoticeText] = useState("");
  const [isBasicOnly, setIsBasicOnly] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [inputMethod, setInputMethod] = useState<"manual" | "pdf">("manual");
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
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
          input_method: isBasicOnly ? null : inputMethod,
          source_filename: isBasicOnly ? null : sourceFilename,
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
      <ApiBadge method="POST" endpoint="/api/strategy" />

      <PageTitle
        title="전략 진단"
        description="프로필과 관심 공고를 바탕으로 청약 당첨 가능성을 분석합니다."
      />

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

      <div className="space-y-8">
        <Card className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[17px] flex items-center gap-2">
              <User className="w-5 h-5 text-[#007aff]" />
              현재 기준 프로필
            </h3>
            <button
              onClick={() => navigate("/profile")}
              disabled={isRunning}
              className="text-[14px] text-[#007aff] hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
            >
              수정하기
            </button>
          </div>

          <div className="bg-[#f5f5f7] rounded-[16px] p-5 flex flex-wrap gap-x-8 gap-y-4 text-[14px]">
            <div>
              <div className="text-[#6e6e73] mb-1">통장 유형</div>
              <div className="font-medium">종합저축 (4년, 600만)</div>
            </div>
            <div>
              <div className="text-[#6e6e73] mb-1">주거 요건</div>
              <div className="font-medium">서울특별시 / 세대주</div>
            </div>
            <div>
              <div className="text-[#6e6e73] mb-1">주택 소유</div>
              <div className="font-medium">무주택 (생애최초)</div>
            </div>
          </div>
        </Card>

        <Card className="p-8">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-[17px] mb-1">관심 공고문 텍스트 (선택)</h3>
              <p className="text-[14px] text-[#6e6e73]">모집공고문의 주요 내용을 복사해서 붙여넣어주세요.</p>
            </div>
            <Button variant="outline" className="text-[13px] py-2 px-4 h-auto shrink-0" onClick={() => navigate("/pdf")} disabled={isRunning}>
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
            className="w-full h-[200px] bg-[#f5f5f7] border border-transparent rounded-[16px] p-5 text-[15px] focus:outline-none focus:bg-white focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] resize-none transition-colors mb-6 disabled:opacity-50"
            placeholder="여기에 모집공고문을 붙여넣으세요..."
            value={noticeText}
            onChange={(e) => setNoticeText(e.target.value)}
            disabled={isBasicOnly || isRunning}
          ></textarea>

          <label className="flex items-center gap-3 mb-8 cursor-pointer group">
            <div className="relative flex items-center">
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
              <div className="w-6 h-6 rounded-[8px] border-2 border-[#e5e5e7] peer-checked:bg-[#007aff] peer-checked:border-[#007aff] transition-colors flex items-center justify-center group-hover:border-[#007aff]/50">
                <CheckIcon className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100" />
              </div>
            </div>
            <span className="text-[15px] font-medium select-none">공고 없이 기본 자격만 확인하기</span>
          </label>

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
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
