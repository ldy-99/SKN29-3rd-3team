import { Home, MapPin, Pencil, User } from "lucide-react";
import { Card } from "../../components/UI";

type StrategyProfileSummaryProps = {
  isBusy: boolean;
  onEditProfile: () => void;
};

export function StrategyProfileSummary({ isBusy, onEditProfile }: StrategyProfileSummaryProps) {
  return (
    <Card className="p-7 !rounded-[20px] !border-[#e6e0d6] !shadow-[0_10px_32px_rgba(35,45,60,0.05)]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-[18px] flex items-center gap-2 text-[#152846]">
          <User className="w-5 h-5 text-[#b86a12]" />
          현재 기준 프로필
        </h3>
        <button
          onClick={onEditProfile}
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
  );
}
