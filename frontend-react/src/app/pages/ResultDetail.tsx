import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, PageTitle, ApiBadge, StatusBadge, WarningBox, Button, SettingsList } from "../components/UI";
import { api } from "../api/client";

export function ResultDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const isPartial = result?.overall_analysis_status === "PARTIAL";

  useEffect(() => {
    api.getStrategy(id ?? "")
      .then(setResult)
      .catch((error) => setError(error instanceof Error ? error.message : "전략 상세 조회에 실패했습니다."));
  }, [id]);

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button className="text-[14px] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors" onClick={() => navigate("/results")}>
          ← 돌아가기
        </button>
      </div>

      <ApiBadge method="GET" endpoint={`/api/strategy/${id}`} />
      
      <PageTitle
        title={result?.announcement_confirmed?.announcement_name ?? "청약 전략 진단 결과"}
        description={`${result?.created_at ?? "fixture"} 기준 진단 결과`}
      />

      {error && (
        <WarningBox type="error" title="API 연결 오류">
          {error}
        </WarningBox>
      )}

      {result && (
        <div className="mb-6 flex gap-2">
          <StatusBadge status={result.status} />
          <StatusBadge status={result.overall_analysis_status} />
        </div>
      )}

      {isPartial && (
        <WarningBox type="warning" title="일부 정보가 부족합니다">
          월평균 소득 및 혼인 기간 정보가 비어 있어 신혼부부 특별공급 자격을 판단할 수 없었습니다. 프로필을 채우면 더 정확해집니다.
        </WarningBox>
      )}

      <Card className="mb-8 overflow-hidden border-none bg-gradient-to-br from-[#007aff] to-[#005bb5] text-white">
        <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-white/80 text-[15px] font-medium mb-2">종합 지원 가능성</div>
            <div className="text-[48px] md:text-[64px] font-bold leading-none tracking-tight">보통</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-[24px] p-6 text-center min-w-[160px]">
            <div className="text-white/80 text-[13px] mb-1">예상 가점</div>
            <div className="text-[32px] font-bold">{isPartial ? "부분" : "완료"}</div>
          </div>
        </div>
      </Card>

      <div className="mb-8">
        <h3 className="text-[20px] font-bold mb-4 px-2">추천 공급유형</h3>
        <SettingsList>
          {[
            { rank: 1, type: "생애최초 특별공급", chance: "높음", desc: "무주택/예치금 조건 충족" },
            { rank: 2, type: "일반공급 1순위", chance: "보통", desc: "가입 24개월 이상, 무주택 세대주" },
            { rank: 3, type: "신혼부부 특별공급", chance: "낮음", desc: "정보 부족으로 판단 보류" },
          ].map((item, idx) => (
            <div key={item.rank} className={`py-4 flex items-center gap-4 ${idx !== 2 ? 'border-b border-[#e5e5e7]' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-[#007aff]/10 text-[#007aff] font-bold flex items-center justify-center shrink-0 text-[15px]">
                {item.rank}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="font-semibold text-[16px]">{item.type}</h4>
                  <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full ${
                    item.chance === "높음" ? "bg-[#34c759]/10 text-[#34c759]" :
                    item.chance === "보통" ? "bg-[#ff9f0a]/10 text-[#ff9f0a]" : "bg-[#f5f5f7] text-[#6e6e73]"
                  }`}>
                    {item.chance}
                  </span>
                </div>
                <p className="text-[14px] text-[#6e6e73]">{item.desc}</p>
              </div>
            </div>
          ))}
        </SettingsList>
      </div>

      <div className="mb-10">
        <h3 className="text-[20px] font-bold mb-4 px-2">상세 확인 사항</h3>
        <SettingsList>
          <div className="py-4 border-b border-[#e5e5e7]">
            <h4 className="font-semibold text-[15px] mb-2 text-[#34c759]">충족된 조건</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73]">
              <li>• 청약통장 가입 후 24개월 경과 확인</li>
              <li>• 서울지역 예치금 300만원 이상 충족</li>
              <li>• 무주택 세대주 요건 충족</li>
            </ul>
          </div>
          <div className="py-4">
            <h4 className="font-semibold text-[15px] mb-2 text-[#ff9f0a]">확인 필요한 항목</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73]">
              {Object.entries(result?.missing_fields_by_supply_type ?? {}).map(([supplyType, fields]) => (
                <li key={supplyType}>• {supplyType}: {(fields as string[]).join(", ")}</li>
              ))}
              {!result?.missing_fields_by_supply_type && <li>• 추가 확인 항목이 없습니다.</li>}
            </ul>
          </div>
        </SettingsList>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" className="flex-1" onClick={() => navigate("/profile")}>
          프로필 보완하기
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/pdf")}>
          PDF 분석하기
        </Button>
      </div>
    </div>
  );
}
