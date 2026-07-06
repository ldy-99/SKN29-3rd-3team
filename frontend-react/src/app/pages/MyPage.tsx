// 역할: 로그인 사용자의 계정 정보와 Django에 저장된 전략 진단 이력을 조회합니다.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, CalendarDays, History, RefreshCw, User } from "lucide-react";
import { Button, Card, ErrorNotice, PageTitle, StatusBadge } from "../components/UI";
import { api, CurrentUser, StrategyRecord } from "../api/client";

export function MyPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const loadMyPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [currentUser, savedStrategies] = await Promise.all([
        api.getMe(),
        api.getMyStrategies(),
      ]);
      setUser(currentUser);
      setStrategies(savedStrategies);
    } catch (error) {
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMyPage();
  }, [loadMyPage]);

  const completedCount = useMemo(
    () => strategies.filter((item) => item.status === "SUCCEEDED").length,
    [strategies],
  );

  return (
    <div className="pb-20">
      <PageTitle
        title="마이페이지"
        description="내 계정과 저장된 전략 진단 기록을 확인하고 결과를 다시 조회할 수 있습니다."
        action={
          <Button variant="outline" onClick={() => void loadMyPage()} disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        }
      />

      <ErrorNotice error={error} fallbackMessage="마이페이지 정보를 불러오지 못했습니다." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <SummaryCard
          icon={<User className="w-5 h-5" />}
          label="로그인 계정"
          value={user?.username ?? (isLoading ? "불러오는 중" : "확인 필요")}
          description={user?.email ?? ""}
        />
        <SummaryCard
          icon={<History className="w-5 h-5" />}
          label="저장된 진단"
          value={`${strategies.length}건`}
          description="Django 저장 기록"
        />
        <SummaryCard
          icon={<CalendarDays className="w-5 h-5" />}
          label="완료된 진단"
          value={`${completedCount}건`}
          description="결과 재조회 가능"
        />
      </div>

      <div className="mb-5 flex items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-[22px] font-bold text-[#152846]">전략 진단 기록</h2>
          <p className="mt-1 text-[14px] text-[#69717d]">진단 실행 시 Django에 자동 저장된 기록입니다.</p>
        </div>
        <Button onClick={() => navigate("/strategy")}>새 진단</Button>
      </div>

      {isLoading ? (
        <Card className="p-10 text-center text-[14px] text-[#6e6e73]">
          저장된 진단 기록을 불러오고 있습니다.
        </Card>
      ) : strategies.length === 0 ? (
        <Card className="p-10 text-center">
          <History className="w-10 h-10 mx-auto mb-4 text-[#a1a1a6]" />
          <h3 className="font-semibold text-[18px] mb-2">저장된 진단이 없습니다</h3>
          <p className="text-[14px] text-[#6e6e73] mb-6">전략 진단을 실행하면 결과가 이곳에 자동 저장됩니다.</p>
          <Button onClick={() => navigate("/strategy")}>첫 진단 시작하기</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {strategies.map((strategy) => (
            <StrategyHistoryCard
              key={strategy.strategy_id}
              strategy={strategy}
              onOpen={() => navigate(`/results/${strategy.strategy_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  description,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="p-5">
      <div className="w-9 h-9 rounded-[12px] bg-[#102e5a]/8 text-[#102e5a] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-[13px] text-[#6e6e73]">{label}</p>
      <p className="mt-1 text-[20px] font-bold text-[#152846] break-all">{value}</p>
      {description && <p className="mt-1 text-[12px] text-[#86868b] break-all">{description}</p>}
    </Card>
  );
}

function StrategyHistoryCard({
  strategy,
  onOpen,
}: {
  strategy: StrategyRecord;
  onOpen: () => void;
}) {
  const inputSnapshot = asRecord(strategy.input_snapshot);
  const inputAnnouncement = asRecord(inputSnapshot?.announcement);
  const announcement = asRecord(strategy.announcement_confirmed);
  const title =
    stringValue(announcement?.announcement_name) ??
    stringValue(inputAnnouncement?.source_filename) ??
    (strategy.diagnosis_mode === "PROFILE_ONLY" ? "기본 자격 진단" : "공고 기반 전략 진단");
  const recommendedSupply = strategy.recommended_supply || "추천 유형 확인 필요";
  const displayStatus = strategy.overall_analysis_status || strategy.status;

  return (
    <Card
      className="p-6 cursor-pointer hover:border-[#245ea8]/35 hover:shadow-[0_10px_30px_rgba(36,94,168,0.08)] transition-all"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <StatusBadge status={strategy.status} />
            {displayStatus !== strategy.status && <StatusBadge status={displayStatus} />}
            <span className="text-[12px] text-[#86868b]">{formatDate(strategy.created_at)}</span>
          </div>
          <h3 className="font-bold text-[18px] text-[#152846] truncate">{title}</h3>
          <p className="mt-2 text-[14px] text-[#596273]">
            추천 공급유형 <span className="font-semibold text-[#245ea8]">{recommendedSupply}</span>
          </p>
          <p className="mt-1 text-[12px] text-[#86868b]">
            {strategy.diagnosis_mode === "PROFILE_ONLY" ? "프로필 기준" : "공고문 기준"} · ID {strategy.strategy_id}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[14px] font-semibold text-[#245ea8] shrink-0">
          결과 다시 보기
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
