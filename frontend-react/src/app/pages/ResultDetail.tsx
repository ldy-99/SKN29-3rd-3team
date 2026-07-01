import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, PageTitle, ApiBadge, StatusBadge, WarningBox, Button, SettingsList } from "../components/UI";
import { api } from "../api/client";

type UnknownRecord = Record<string, unknown>;

type SupplyRankItem = {
  rank: number;
  type: string;
  chance: string;
  desc: string;
  missingFields: string[];
  sourceRefs: string[];
};

export function ResultDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStrategy(id ?? "")
      .then((data) => setResult(data as UnknownRecord))
      .catch((error) => setError(error instanceof Error ? error.message : "전략 상세 조회에 실패했습니다."));
  }, [id]);

  const viewModel = useMemo(() => buildResultViewModel(result), [result]);

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button
          className="text-[14px] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors"
          onClick={() => navigate("/strategy")}
        >
          ← 돌아가기
        </button>
      </div>

      <ApiBadge method="GET" endpoint={`/api/strategy/${id}`} />

      <PageTitle
        title={viewModel.title}
        description={`${viewModel.createdAt} 기준 진단 결과`}
      />

      {error && (
        <WarningBox type="error" title="API 연결 오류">
          {error}
        </WarningBox>
      )}

      {result && (
        <div className="mb-6 flex flex-wrap gap-2">
          {viewModel.statuses.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      )}

      {viewModel.isPartial && (
        <WarningBox type="warning" title="일부 정보가 부족합니다">
          일부 공급유형은 입력값 부족으로 제한적으로 판단되었습니다. 프로필이나 공고 정보를 보완하면 더 정확해집니다.
        </WarningBox>
      )}

      <Card className="mb-8 overflow-hidden border-none bg-gradient-to-br from-[#007aff] to-[#005bb5] text-white">
        <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-white/80 text-[15px] font-medium mb-2">추천 공급유형</div>
            <div className="text-[40px] md:text-[56px] font-bold leading-tight tracking-tight break-keep">
              {viewModel.recommendedSupply}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-[24px] p-6 text-center min-w-[160px]">
            <div className="text-white/80 text-[13px] mb-1">진단 상태</div>
            <div className="text-[28px] font-bold">{viewModel.resultLabel}</div>
          </div>
        </div>
      </Card>

      {viewModel.summary && (
        <WarningBox type="info" title="요약">
          {viewModel.summary}
        </WarningBox>
      )}

      <div className="mb-8">
        <h3 className="text-[20px] font-bold mb-4 px-2">추천 공급유형</h3>
        <SettingsList>
          {viewModel.supplyRank.length > 0 ? (
            viewModel.supplyRank.map((item, idx) => (
              <div key={`${item.rank}-${item.type}`} className={`py-4 flex items-center gap-4 ${idx !== viewModel.supplyRank.length - 1 ? "border-b border-[#e5e5e7]" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-[#007aff]/10 text-[#007aff] font-bold flex items-center justify-center shrink-0 text-[15px]">
                  {item.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-1">
                    <h4 className="font-semibold text-[16px] break-keep">{item.type}</h4>
                    <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto ${chanceClassName(item.chance)}`}>
                      {item.chance}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#6e6e73] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-5 text-[14px] text-[#6e6e73]">추천 공급유형 데이터가 아직 없습니다.</div>
          )}
        </SettingsList>
      </div>

      <div className="mb-10">
        <h3 className="text-[20px] font-bold mb-4 px-2">상세 확인 사항</h3>
        <SettingsList>
          <div className="py-4 border-b border-[#e5e5e7]">
            <h4 className="font-semibold text-[15px] mb-2 text-[#34c759]">분석 결과</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73] leading-relaxed">
              {viewModel.analysisItems.length > 0 ? (
                viewModel.analysisItems.map((item) => <li key={item}>• {item}</li>)
              ) : (
                <li>• 상세 분석 결과가 아직 없습니다.</li>
              )}
            </ul>
          </div>
          <div className="py-4">
            <h4 className="font-semibold text-[15px] mb-2 text-[#ff9f0a]">확인 필요한 항목</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73] leading-relaxed">
              {viewModel.missingItems.length > 0 ? (
                viewModel.missingItems.map((item) => <li key={item}>• {item}</li>)
              ) : (
                <li>• 추가 확인 항목이 없습니다.</li>
              )}
            </ul>
          </div>
        </SettingsList>
      </div>

      {viewModel.debugPayload && (
        <div className="mb-10">
          <h3 className="text-[20px] font-bold mb-4 px-2">FastAPI 원본 요약</h3>
          <pre className="bg-[#1d1d1f] text-white rounded-[20px] p-5 overflow-auto text-[12px] leading-relaxed max-h-[320px]">
            {viewModel.debugPayload}
          </pre>
        </div>
      )}

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

function buildResultViewModel(result: UnknownRecord | null) {
  const payload = asRecord(result?.result_payload) ?? {};
  const report = asRecord(result?.report) ?? asRecord(payload.report) ?? asRecord(asRecord(payload.node6)?.final_report) ?? {};
  const announcement = asRecord(result?.announcement_confirmed) ?? asRecord(payload.announcement) ?? {};
  const supplyRank = normalizeSupplyRank(result?.supply_rank ?? payload.supply_rank);
  const missingItems = collectMissingItems(result, payload, supplyRank);
  const analysisItems = collectAnalysisItems(report, payload);
  const resultStatus = stringValue(payload.status) ?? stringValue(result?.overall_analysis_status);

  return {
    title: stringValue(announcement.announcement_name) ?? "청약 전략 진단 결과",
    createdAt: stringValue(result?.created_at) ?? "방금",
    statuses: uniqueStrings([
      stringValue(result?.status),
      stringValue(result?.overall_analysis_status),
      resultStatus === "success" ? "CALCULATED" : resultStatus,
    ]),
    isPartial: result?.overall_analysis_status === "PARTIAL" || missingItems.length > 0,
    recommendedSupply: stringValue(result?.recommended_supply) ?? stringValue(payload.recommended_supply) ?? supplyRank[0]?.type ?? "확인 필요",
    resultLabel: resultStatus === "success" ? "완료" : resultStatus === "waiting" ? "대기" : "확인",
    summary: collectSummary(report, payload),
    supplyRank,
    analysisItems,
    missingItems,
    debugPayload: Object.keys(payload).length > 0 ? JSON.stringify(payload, null, 2) : null,
  };
}

function normalizeSupplyRank(value: unknown): SupplyRankItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((raw, index) => {
    const item = asRecord(raw) ?? {};
    const reasons = stringArray(item.reasons);
    const reason = stringValue(item.reason);
    const score = numberValue(item.score);
    const status = stringValue(item.status);
    const type = stringValue(item.type) ?? stringValue(item.supply_type) ?? stringValue(item.name) ?? `공급유형 ${index + 1}`;

    return {
      rank: numberValue(item.rank) ?? index + 1,
      type,
      chance: stringValue(item.chance) ?? status ?? (score !== undefined ? `${score}점` : "검토"),
      desc: reason ?? reasons.join(", ") ?? "상세 사유가 응답에 포함되지 않았습니다.",
      missingFields: stringArray(item.missing_fields),
      sourceRefs: stringArray(item.source_refs),
    };
  });
}

function collectMissingItems(result: UnknownRecord | null, payload: UnknownRecord, supplyRank: SupplyRankItem[]) {
  const explicitMissing = asRecord(result?.missing_fields_by_supply_type);
  if (explicitMissing) {
    return Object.entries(explicitMissing).map(([supplyType, fields]) => `${supplyType}: ${stringArray(fields).join(", ")}`);
  }

  const fromSupplyRank = supplyRank.flatMap((item) =>
    item.missingFields.map((field) => `${item.type}: ${field}`)
  );

  const report = asRecord(payload.report);
  const fromReport = stringArray(report?.missing_fields);

  return uniqueStrings([...fromSupplyRank, ...fromReport]);
}

function collectAnalysisItems(report: UnknownRecord, payload: UnknownRecord) {
  const candidates = [
    ...stringArray(report.key_findings),
    ...stringArray(report.recommendations),
    ...stringArray(report.warnings),
    ...stringArray(payload.warnings),
  ];

  const node5 = asRecord(payload.node5);
  const riskResult = asRecord(node5?.risk_result);
  const riskSummary = stringValue(riskResult?.summary) ?? stringValue(riskResult?.message);
  if (riskSummary) candidates.push(riskSummary);

  return uniqueStrings(candidates);
}

function collectSummary(report: UnknownRecord, payload: UnknownRecord) {
  return (
    stringValue(report.summary) ??
    stringValue(report.final_summary) ??
    stringValue(report.message) ??
    stringValue(payload.message)
  );
}

function chanceClassName(chance: string) {
  if (chance.includes("높") || chance.includes("PASS") || chance.includes("가능")) {
    return "bg-[#34c759]/10 text-[#34c759]";
  }
  if (chance.includes("낮") || chance.includes("FAIL") || chance.includes("불가")) {
    return "bg-[#ff3b30]/10 text-[#ff3b30]";
  }
  return "bg-[#ff9f0a]/10 text-[#ff9f0a]";
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item : JSON.stringify(item))
    .filter((item): item is string => Boolean(item));
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
