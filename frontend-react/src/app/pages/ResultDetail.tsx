// 역할: 저장된 전략 진단 결과를 조회하고 사용자에게 요약/상세 결과를 보여주는 화면입니다.
// 흐름: ResultDetail.tsx -> api.getStrategy -> Django StrategyDetailAPIView -> StrategyRun.result_payload.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, PageTitle, StatusBadge, WarningBox, Button, ErrorNotice, SettingsList } from "../components/UI";
import { api } from "../api/client";
import { CheckCircle2, FileText, Info } from "lucide-react";

type UnknownRecord = Record<string, unknown>;

type SupplyRankItem = {
  rank: number;
  type: string;
  chance: string;
  desc: string;
  missingFields: string[];
  matchedItems: string[];
  sourceRefs: string[];
};

export function ResultDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.getStrategy(id ?? "")
      .then((data) => setResult(data as UnknownRecord))
      .catch((error) => setError(error));
  }, [id]);

  const viewModel = useMemo(() => buildResultViewModel(result), [result]);

  return (
    <div className="pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button
          className="text-[14px] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors"
          onClick={() => navigate("/mypage")}
        >
          ← 진단 기록으로
        </button>
      </div>

      <PageTitle
        title={viewModel.title}
        description={`${viewModel.createdAt} 기준 진단 결과`}
      />

      <ErrorNotice error={error} fallbackMessage="전략 상세 조회에 실패했습니다." />

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

      {viewModel.failureMessage && (
        <WarningBox type="error" title="진단이 완료되지 않았습니다">
          {viewModel.failureMessage}
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
        <SummaryReport
          content={viewModel.summary}
          isProfileOnly={viewModel.isProfileOnly}
        />
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
                  {item.matchedItems.length > 0 && (
                    <p className="mt-2 text-[12px] text-[#86868b] leading-relaxed">
                      충족·반영 항목: {item.matchedItems.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="py-5 text-[14px] text-[#6e6e73]">추천 공급유형 데이터가 아직 없습니다.</div>
          )}
        </SettingsList>
      </div>

      {viewModel.finance && (
        <div className="mb-8">
          <h3 className="text-[20px] font-bold mb-4 px-2">재무 분석</h3>
          <SettingsList>
            <ResultRow label="분양가" value={formatWon(viewModel.finance.price)} />
            <ResultRow label="대출 가능 금액" value={formatWon(viewModel.finance.loanAmount)} />
            <ResultRow label="적용 LTV" value={formatRatio(viewModel.finance.ltvRate)} />
            <ResultRow label="실투자금" value={formatWon(viewModel.finance.realInvestment)} />
            <ResultRow label="지역 구분" value={viewModel.finance.areaType ?? "확인 필요"} />
            <ResultRow
              label="자금 위험도"
              value={[
                viewModel.finance.riskLevel,
                formatRatio(viewModel.finance.riskRatio),
              ].filter(Boolean).join(" · ") || "확인 필요"}
              last
            />
          </SettingsList>
          {viewModel.finance.riskDescription && (
            <div className="mt-3">
              <WarningBox type="warning" title="자금 위험 안내">
                {viewModel.finance.riskDescription}
              </WarningBox>
            </div>
          )}
        </div>
      )}

      {viewModel.strategy && (
        <div className="mb-8">
          <h3 className="text-[20px] font-bold mb-4 px-2">상세 전략</h3>
          <StrategyReport content={viewModel.strategy} />
        </div>
      )}

      <div className="mb-10">
        <h3 className="text-[20px] font-bold mb-4 px-2">상세 확인 사항</h3>
        <SettingsList>
          <div className="py-4 border-b border-[#e5e5e7]">
            <h4 className="font-semibold text-[15px] mb-2 text-[#34c759]">분석 결과</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73] leading-relaxed">
              {viewModel.analysisItems.length > 0 ? (
                viewModel.analysisItems.map((item) => <li key={item}>• {item}</li>)
              ) : (
                <li>• 현재 진단 응답에 별도로 분류된 분석 항목이 없습니다.</li>
              )}
            </ul>
          </div>
          <div className="py-4">
            <h4 className="font-semibold text-[15px] mb-2 text-[#ff9f0a]">확인 필요한 항목</h4>
            <ul className="space-y-2 text-[14px] text-[#6e6e73] leading-relaxed">
              {viewModel.missingItems.length > 0 ? (
                viewModel.missingItems.map((item) => <li key={item}>• {item}</li>)
              ) : (
                <li>• 현재 진단 응답에는 추가 확인이 필요한 항목이 없습니다.</li>
              )}
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

function buildResultViewModel(result: UnknownRecord | null) {
  const payload = asRecord(result?.result_payload) ?? {};
  const report = asRecord(result?.report) ?? asRecord(payload.report) ?? asRecord(asRecord(payload.node6)?.final_report) ?? {};
  const announcement = asRecord(result?.announcement_confirmed) ?? asRecord(payload.announcement) ?? {};
  const supplyRank = normalizeSupplyRank(payload.supply_rank ?? report.supply_rank ?? result?.supply_rank);
  const missingItems = collectMissingItems(result, payload, supplyRank);
  const analysisItems = collectAnalysisItems(report, payload, supplyRank);
  const resultStatus = stringValue(payload.status) ?? stringValue(result?.overall_analysis_status);
  const finance = normalizeFinance(report, payload);
  const strategy =
    stringValue(report.strategy) ??
    stringValue(payload.strategy) ??
    stringValue(asRecord(payload.node5)?.agent_result);
  const failureMessage =
    result?.status === "FAILED" || result?.overall_analysis_status === "FAILED"
      ? stringValue(asRecord(payload.error)?.message) ??
        stringValue(payload.error) ??
        stringValue(payload.message) ??
        "서버 처리 중 오류가 발생해 상세 결과를 생성하지 못했습니다."
      : undefined;

  return {
    title: stringValue(announcement.announcement_name) ?? "청약 전략 진단 결과",
    createdAt: stringValue(result?.created_at) ?? "방금",
    statuses: uniqueStrings([
      stringValue(result?.status),
      stringValue(result?.overall_analysis_status),
      resultStatus === "success" ? "CALCULATED" : resultStatus,
    ]),
    isPartial: result?.overall_analysis_status === "PARTIAL" || missingItems.length > 0,
    isProfileOnly: result?.diagnosis_mode === "PROFILE_ONLY",
    recommendedSupply: stringValue(result?.recommended_supply) ?? stringValue(payload.recommended_supply) ?? supplyRank[0]?.type ?? "확인 필요",
    resultLabel: resultStatus === "success" ? "완료" : resultStatus === "waiting" ? "대기" : "확인",
    summary: collectSummary(report, payload),
    supplyRank,
    analysisItems,
    missingItems,
    finance,
    strategy,
    failureMessage,
  };
}

type StrategySection = {
  title: string;
  lines: string[];
};

function SummaryReport({
  content,
  isProfileOnly,
}: {
  content: string;
  isProfileOnly: boolean;
}) {
  const sections = parseStrategySections(content);

  return (
    <Card className="mb-8 !rounded-[22px] !border-[#dce4ef] !bg-[#f8fbff]">
      <div className="border-b border-[#dce4ef] px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e7f1ff] text-[#0b5bd3]">
            <Info className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[17px] font-bold text-[#152846]">진단 요약</h3>
              {isProfileOnly && (
                <span className="rounded-full bg-[#fff1d9] px-2.5 py-1 text-[11px] font-bold text-[#9a5c11]">
                  공고 없이 진단
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-[#68717d]">
              {isProfileOnly
                ? "저장된 청약 조건만으로 분석한 결과입니다. 실제 신청 전 모집공고의 세부 자격을 확인해주세요."
                : "프로필과 모집공고를 함께 분석한 핵심 결과입니다."}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        {sections.map((section, sectionIndex) => (
          <section key={`${section.title}-${sectionIndex}`}>
            <h4 className="mb-2 text-[14px] font-bold text-[#0b5bd3]">
              {stripMarkdown(section.title)}
            </h4>
            <div className="space-y-2">
              {section.lines.map((line, lineIndex) => (
                <StrategyLine
                  key={`${line.slice(0, 30)}-${lineIndex}`}
                  line={line}
                  compact
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function StrategyReport({ content }: { content: string }) {
  const parsedSections = parseStrategySections(content);
  const firstSection = parsedSections[0];
  const hasTitleOnlySection =
    parsedSections.length > 1 && firstSection?.lines.length === 0;
  const reportTitle = hasTitleOnlySection
    ? firstSection.title
    : "맞춤 청약 전략";
  const sections = hasTitleOnlySection
    ? parsedSections.slice(1)
    : parsedSections;

  return (
    <Card className="!overflow-visible !rounded-[22px] !border-[#e3ded4]">
      <div className="flex items-center gap-3 rounded-t-[22px] border-b border-[#e8e2d8] bg-[#f8f4ec] px-6 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#102e5a] text-white">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[12px] font-bold tracking-[0.05em] text-[#b86a12]">
            STRATEGY REPORT
          </p>
          <h4 className="text-[18px] font-bold text-[#152846]">
            {stripMarkdown(reportTitle)}
          </h4>
        </div>
      </div>

      <div className="space-y-4 p-5 md:p-6">
        {sections.map((section, sectionIndex) => (
          <section
            key={`${section.title}-${sectionIndex}`}
            className="rounded-[18px] border border-[#e8e3da] bg-white p-5 md:p-6 shadow-[0_5px_18px_rgba(35,45,60,0.035)]"
          >
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-[12px] font-bold text-[#0b5bd3]">
                {sectionIndex + 1}
              </span>
              <h5 className="text-[17px] font-bold leading-relaxed text-[#152846]">
                <StrategyInline text={section.title} />
              </h5>
            </div>

            <div className="space-y-3 pl-0 md:pl-10">
              {section.lines.map((line, lineIndex) => (
                <StrategyLine
                  key={`${line.slice(0, 30)}-${lineIndex}`}
                  line={line}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function parseStrategySections(content: string): StrategySection[] {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\s+(#{1,6}\s+)/g, "\n$1")
    .replace(/\s+(-\s+)/g, "\n$1")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections: StrategySection[] = [];
  let current: StrategySection = { title: "핵심 분석", lines: [] };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      if (current.lines.length > 0 || current.title !== "핵심 분석") {
        sections.push(current);
      }
      current = { title: heading[1].trim(), lines: [] };
      continue;
    }
    current.lines.push(line);
  }

  if (current.lines.length > 0 || current.title !== "핵심 분석") {
    sections.push(current);
  }

  return sections.length > 0
    ? sections
    : [{ title: "상세 분석", lines: [content] }];
}

function StrategyLine({
  line,
  compact = false,
}: {
  line: string;
  compact?: boolean;
}) {
  const bullet = line.match(/^[-*]\s+(.+)$/);
  const text = bullet ? bullet[1] : line;
  const labelValue = text.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);

  if (labelValue) {
    return (
      <div className={`rounded-[12px] px-4 py-3 ${compact ? "bg-white/80" : "bg-[#f7f8fa]"}`}>
        <p className="text-[12px] font-bold text-[#0b5bd3]">
          {stripMarkdown(labelValue[1])}
        </p>
        {labelValue[2] && (
          <p className="mt-1 text-[14px] leading-6 text-[#465365]">
            <StrategyInline text={labelValue[2]} />
          </p>
        )}
      </div>
    );
  }

  if (bullet) {
    return (
      <div className="flex items-start gap-2.5 text-[14px] leading-7 text-[#465365]">
        <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-[#2d8a54]" />
        <p><StrategyInline text={text} /></p>
      </div>
    );
  }

  return (
    <p className="text-[14px] leading-7 text-[#465365]">
      <StrategyInline text={text} />
    </p>
  );
}

function StrategyInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index} className="font-bold text-[#26364e]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function stripMarkdown(value: string) {
  return value.replace(/\*\*/g, "").trim();
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
    const missingFields = uniqueStrings([
      ...stringArray(item.missing_fields),
      ...stringArray(item.missing_items),
    ]);

    return {
      rank: numberValue(item.rank) ?? index + 1,
      type,
      chance:
        stringValue(item.chance) ??
        stringValue(item.competitiveness) ??
        status ??
        (score !== undefined ? `${score}점` : "검토"),
      desc: reason ?? (reasons.length > 0 ? reasons.join(", ") : "상세 사유가 응답에 포함되지 않았습니다."),
      missingFields,
      matchedItems: stringArray(item.matched_items),
      sourceRefs: stringArray(item.source_refs),
    };
  });
}

function collectMissingItems(result: UnknownRecord | null, payload: UnknownRecord, supplyRank: SupplyRankItem[]) {
  const explicitMissing = asRecord(result?.missing_fields_by_supply_type);
  const fromExplicit = explicitMissing
    ? Object.entries(explicitMissing)
      .map(([supplyType, fields]) => {
        const normalizedFields = stringArray(fields);
        return normalizedFields.length > 0 ? `${supplyType}: ${normalizedFields.join(", ")}` : undefined;
      })
      .filter((item): item is string => Boolean(item))
    : [];

  const fromSupplyRank = supplyRank.flatMap((item) =>
    item.missingFields.map((field) => `${item.type}: ${field}`)
  );

  const payloadReport = asRecord(payload.report) ?? asRecord(asRecord(payload.node6)?.final_report);
  const reportSupplyRank = normalizeSupplyRank(payloadReport?.supply_rank);
  const supplyAnalysis = asRecord(payload.supply_analysis);
  const availableSupplies = normalizeSupplyRank(supplyAnalysis?.available_supplies);
  const recommendedSupplyTypes = normalizeSupplyRank(result?.recommended_supply_types);
  const fromReport = uniqueStrings([
    ...stringArray(payloadReport?.missing_fields),
    ...stringArray(payloadReport?.missing_items),
  ]);
  const fromNestedSupplyData = [
    ...reportSupplyRank,
    ...availableSupplies,
    ...recommendedSupplyTypes,
  ].flatMap((item) =>
    item.missingFields.map((field) => `${item.type}: ${field}`)
  );
  const warnings = uniqueStrings([
    ...stringArray(result?.warnings),
    ...stringArray(payload.warnings),
    ...stringArray(payloadReport?.warnings),
  ]);

  return uniqueStrings([
    ...fromExplicit,
    ...fromSupplyRank,
    ...fromReport,
    ...fromNestedSupplyData,
    ...warnings,
  ]);
}

function collectAnalysisItems(
  report: UnknownRecord,
  payload: UnknownRecord,
  supplyRank: SupplyRankItem[],
) {
  const candidates = [
    ...stringArray(report.key_findings),
    ...stringArray(report.recommendations),
    ...supplyRank.flatMap((item) =>
      item.matchedItems.map((matched) => `${item.type}: ${matched}`)
    ),
  ];

  const node5 = asRecord(payload.node5);
  const riskResult = asRecord(node5?.risk_result);
  const finance = asRecord(report.finance);
  const riskSummary =
    stringValue(finance?.risk_description) ??
    stringValue(riskResult?.description) ??
    stringValue(riskResult?.summary) ??
    stringValue(riskResult?.message);
  if (riskSummary) candidates.push(riskSummary);
  candidates.push(...stringArray(riskResult?.action_items));

  return uniqueStrings(candidates);
}

function normalizeFinance(report: UnknownRecord, payload: UnknownRecord) {
  const reportFinance = asRecord(report.finance);
  const payloadFinance = asRecord(payload.finance);
  const node5 = asRecord(payload.node5);
  const loan = asRecord(node5?.loan_result);
  const investment = asRecord(node5?.investment_result);
  const risk = asRecord(node5?.risk_result);
  const source = reportFinance ?? payloadFinance ?? {};

  const normalized = {
    loanAmount: numberValue(source.loan_amount) ?? numberValue(loan?.loan_amount),
    ltvRate: numberValue(source.ltv_rate) ?? numberValue(loan?.ltv_rate),
    areaType: stringValue(source.area_type) ?? stringValue(loan?.area_type),
    realInvestment: numberValue(source.real_investment) ?? numberValue(investment?.real_investment),
    price: numberValue(source.price) ?? numberValue(investment?.price),
    riskLevel: stringValue(source.risk_level) ?? stringValue(risk?.risk_level),
    riskRatio: numberValue(source.risk_ratio) ?? numberValue(risk?.ratio),
    riskDescription: stringValue(source.risk_description) ?? stringValue(risk?.description),
  };

  return Object.values(normalized).some((value) => value !== undefined) ? normalized : null;
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

function formatWon(value: number | undefined) {
  return value === undefined ? "확인 필요" : `${value.toLocaleString("ko-KR")}원`;
}

function formatRatio(value: number | undefined) {
  return value === undefined ? undefined : `${Math.round(value * 100)}%`;
}

function ResultRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div className={`py-4 flex items-center justify-between gap-6 ${last ? "" : "border-b border-[#e5e5e7]"}`}>
      <span className="text-[14px] text-[#6e6e73]">{label}</span>
      <span className="text-[15px] font-semibold text-right">{value}</span>
    </div>
  );
}
