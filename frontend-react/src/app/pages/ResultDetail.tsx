// 역할: 저장된 전략 진단 결과를 조회하고 사용자에게 요약/상세 결과를 보여주는 화면입니다.
// 흐름: ResultDetail.tsx -> api.getStrategy -> Django StrategyDetailAPIView -> StrategyRun.result_payload.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Card, StatusBadge, WarningBox, Button, ErrorNotice } from "../components/UI";
import { api } from "../api/client";
import { CheckCircle2, ChevronDown, Download, FileText, Info, X } from "lucide-react";
import { getAnnouncementPresentation } from "../utils/announcementPresentation";
import type { AnnouncementPresentation } from "../utils/announcementPresentation";

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

type ProfileSummaryItem = {
  label: string;
  value: string;
};

export function ResultDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<UnknownRecord | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  useEffect(() => {
    api.getStrategy(id ?? "")
      .then((data) => setResult(data as UnknownRecord))
      .catch((error) => setError(error));
  }, [id]);

  const viewModel = useMemo(() => buildResultViewModel(result), [result]);
  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <div className="result-print-page pb-20">
      <style>
        {`
          @page {
            size: A4;
            margin: 14mm 12mm;
          }

          @media print {
            html,
            body,
            #root {
              background: white !important;
            }

            body {
              margin: 0 !important;
              color: #152846 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body header,
            body aside,
            .no-print {
              display: none !important;
            }

            main,
            main > div,
            main > div > div {
              max-width: none !important;
              width: auto !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            .result-print-page {
              padding: 0 !important;
              font-size: 10.5pt !important;
              line-height: 1.55 !important;
              color: #152846 !important;
            }

            .result-print-page h1 {
              font-size: 25pt !important;
              line-height: 1.18 !important;
              letter-spacing: 0 !important;
              color: #102e5a !important;
            }

            .result-print-page h2,
            .result-print-page h3 {
              color: #102e5a !important;
              break-after: avoid;
            }

            .result-print-page button {
              display: none !important;
            }

            .result-print-page [class*="shadow-"] {
              box-shadow: none !important;
            }

            .result-print-page [class*="rounded-"] {
              border-radius: 12px !important;
            }

            .result-print-page [class*="bg-gradient"] {
              background: #102e5a !important;
            }

            .result-print-page .print-section,
            .result-print-page details,
            .result-print-page dl,
            .result-print-page ul {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .result-print-page .print-muted-card {
              border: 1px solid #d8cfc1 !important;
              background: #fbfaf7 !important;
            }

            .result-print-page .print-hide {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="no-print flex items-center gap-2 mb-6">
        <button
          className="text-[14px] text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition-colors"
          onClick={() => navigate("/mypage")}
        >
          ← 마이페이지로
        </button>
      </div>

      <ReportHeader
        title={viewModel.title}
        createdAt={viewModel.createdAt}
        recommendedSupply={viewModel.recommendedSupply}
        resultLabel={viewModel.resultLabel}
        isProfileOnly={viewModel.isProfileOnly}
        statuses={viewModel.statuses}
        onDownloadPdf={handleDownloadPdf}
      />

      <div className="print-section print-muted-card mb-6 flex flex-wrap gap-x-5 gap-y-2 rounded-[16px] border border-[#e4d8c5] bg-[#fffaf1] px-5 py-4 text-[13px] text-[#6f5737]">
        <span><strong className="text-[#49351f]">진단 범위</strong> 아파트 분양 청약</span>
        <span><strong className="text-[#49351f]">결과 성격</strong> 참고용 진단</span>
        <span>최종 자격은 해당 입주자모집공고문에서 확인해야 합니다.</span>
      </div>

      <ErrorNotice error={error} fallbackMessage="전략 상세 조회에 실패했습니다." />

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

      {viewModel.summary && (
        <div className="print-section">
          <SummaryReport
            content={viewModel.summary}
            isProfileOnly={viewModel.isProfileOnly}
          />
        </div>
      )}

      <SupplyRecommendationSection items={viewModel.supplyRank} />

      {viewModel.announcementInfo.length > 0 && (
        <AnnouncementInfoPanel items={viewModel.announcementInfo} />
      )}

      {viewModel.finance && (
        <div className="print-section mb-8">
          <FinancePanel finance={viewModel.finance} />
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
        <div className="print-section mb-8">
          <SectionHeading title="상세 전략" description="조건별 판단 근거와 다음 행동을 정리했습니다." />
          <StrategyReport content={viewModel.strategy} />
        </div>
      )}

      <div className="print-section mb-10">
        <SectionHeading title="상세 확인 사항" description="진단에 반영된 항목과 추가 확인이 필요한 항목입니다." />
        <div className="space-y-3">
          <CheckDetailsToggle
            title="분석 결과"
            items={viewModel.analysisItems}
            emptyMessage="현재 진단 응답에 별도로 분류된 분석 항목이 없습니다."
            tone="success"
          />
          <CheckDetailsToggle
            title="확인 필요한 항목"
            items={viewModel.missingItems}
            emptyMessage="현재 진단 응답에는 추가 확인이 필요한 항목이 없습니다."
            tone="warning"
          />
        </div>
      </div>

      <div className="print-section">
        <WarningBox type="info" title="이용 안내 및 면책 조항">
          본 리포트는 입력한 프로필과 공고 정보를 바탕으로 정리한 참고용 진단입니다.
          실제 청약 가능 여부와 최종 자격은 반드시 해당 입주자모집공고문, 청약홈, 사업주체 또는 관계 기관의 공식 안내로 확인해주세요.
        </WarningBox>
      </div>

      <button
        type="button"
        className="no-print fixed bottom-24 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-[#d9d3c8] bg-white px-4 py-3 text-[13px] font-bold text-[#26364e] shadow-[0_16px_42px_rgba(24,31,43,0.14)] transition-all hover:-translate-y-0.5 hover:bg-[#f7f8fb] sm:right-6"
        onClick={() => setIsProfileDialogOpen(true)}
      >
        <UserFloatingIcon />
        내 프로필
      </button>

      <div className="no-print flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            navigate("/profile");
            window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
          }}
        >
          다시 진단하기
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/pdf")}>
          PDF 분석하기
        </Button>
      </div>

      {isProfileDialogOpen && (
        <ProfileSnapshotDialog
          items={viewModel.profileSummaryItems}
          onClose={() => setIsProfileDialogOpen(false)}
        />
      )}
    </div>
  );
}

function UserFloatingIcon() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef4ff] text-[#245ea8]">
      <Info className="h-4 w-4" />
    </span>
  );
}

function ReportHeader({
  title,
  createdAt,
  recommendedSupply,
  resultLabel,
  isProfileOnly,
  statuses,
  onDownloadPdf,
}: {
  title: string;
  createdAt: string;
  recommendedSupply: string;
  resultLabel: string;
  isProfileOnly: boolean;
  statuses: string[];
  onDownloadPdf: () => void;
}) {
  return (
    <Card className="print-section mb-7 !rounded-[24px] !border-[#e2dbcf] bg-[#fffefa] p-6 shadow-[0_16px_48px_rgba(35,45,60,0.06)] md:p-7">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#e2d7c8] bg-white px-3 py-1 text-[12px] font-extrabold tracking-[0.12em] text-[#b86a12]">
              AFIT REPORT
            </span>
            <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-[12px] font-bold text-[#667085]">
              {isProfileOnly ? "기본 조건 분석" : "공고 기반 분석"}
            </span>
          </div>
          <h1 className="text-[34px] font-black leading-tight tracking-[-0.01em] text-[#152846] break-keep md:text-[42px]">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#69717d]">
            {formatDateTime(createdAt)} 기준 · 아파트 분양 청약 진단 결과
          </p>
        </div>

        <Button variant="outline" className="no-print shrink-0 gap-2 !rounded-full !border-[#d9d3c8] bg-white" onClick={onDownloadPdf}>
          <Download className="h-4 w-4" />
          PDF로 저장
        </Button>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
        <ReportMetric label="추천 공급유형" value={recommendedSupply} emphasis />
        <ReportMetric label="진단 상태" value={resultLabel} />
        <div className="rounded-[18px] border border-[#ece6dc] bg-white px-4 py-4">
          <p className="text-[12px] font-bold text-[#7a818c]">처리 상태</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {statuses.length > 0 ? (
              statuses.map((status) => <StatusBadge key={status} status={status} />)
            ) : (
              <span className="text-[14px] font-bold text-[#152846]">확인 중</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReportMetric({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className={`rounded-[18px] border px-4 py-4 ${emphasis ? "border-[#d8c9b5] bg-[#f8f4ec]" : "border-[#ece6dc] bg-white"}`}>
      <p className="text-[12px] font-bold text-[#7a818c]">{label}</p>
      <p className={`mt-2 break-keep font-black leading-tight ${emphasis ? "text-[24px] text-[#102e5a]" : "text-[21px] text-[#152846]"}`}>
        {value}
      </p>
    </div>
  );
}

function AnnouncementInfoPanel({ items }: { items: AnnouncementPresentation["info"] }) {
  const grouped = groupAnnouncementInfo(items);

  return (
    <div className="print-section mb-8">
      <SectionHeading eyebrow="Announcement" title="공고 기본 정보" description="진단에 반영된 핵심 공고 정보만 정리했습니다." />
      <Card className="mt-4 !rounded-[22px] !border-[#e3ded4] bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
          <div>
            <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#b86a12]">
              Supply Summary
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {grouped.supply.length > 0 ? (
                grouped.supply.map((item, index) => (
                  <AnnouncementMetric
                    key={`${item.label}-${item.value}`}
                    label={item.label}
                    value={item.value}
                    strong={index < 2}
                  />
                ))
              ) : (
                <AnnouncementMetric label="공급 정보" value="확인 필요" />
              )}
            </div>
          </div>

          <div className="rounded-[18px] border border-[#ece6dc] bg-[#fffefa] p-4">
            <p className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#b86a12]">
              Schedule
            </p>
            {grouped.schedule.length > 0 ? (
              <div className="space-y-2">
                {grouped.schedule.map((item) => (
                  <AnnouncementMetric
                    key={`${item.label}-${item.value}`}
                    label={item.label}
                    value={item.value}
                    compact
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-[16px] border border-[#ece6dc] bg-white px-4 py-3 text-[13px] font-bold text-[#69717d]">
                주요 일정은 공고문 원문 확인이 필요합니다.
              </p>
            )}

            {grouped.source.length > 0 && (
              <div className="mt-3 space-y-2 rounded-[16px] border border-dashed border-[#ddd7cb] bg-[#fbfaf7] px-4 py-3">
                {grouped.source.map((item) => (
                  <p key={`${item.label}-${item.value}`} className="text-[12px] leading-relaxed text-[#69717d]">
                    <span className="font-bold text-[#344258]">{item.label}</span>
                    <span className="mx-2 text-[#c0b7a8]">/</span>
                    <span className="break-words">{item.value}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function AnnouncementMetric({
  label,
  value,
  strong = false,
  compact = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-[16px] border px-4 ${strong ? "border-[#d8c9b5] bg-[#fbf7ef]" : "border-[#ece6dc] bg-white"} ${compact ? "py-3 sm:flex sm:items-center sm:justify-between sm:gap-4" : "py-3.5"}`}>
      <p className="text-[12px] font-bold text-[#7a818c]">{label}</p>
      <p className={`mt-1 break-words font-black leading-relaxed ${strong ? "text-[19px] text-[#102e5a]" : compact ? "text-[14px] text-[#26364e] sm:mt-0 sm:text-right" : "text-[16px] text-[#26364e]"}`}>
        {value}
      </p>
    </div>
  );
}

function groupAnnouncementInfo(items: AnnouncementPresentation["info"]) {
  const scheduleLabels = new Set(["청약 접수", "당첨자 발표", "모집공고일"]);
  const sourceLabels = new Set(["공고 파일"]);

  return {
    supply: items.filter((item) => !scheduleLabels.has(item.label) && !sourceLabels.has(item.label)),
    schedule: items.filter((item) => scheduleLabels.has(item.label)),
    source: items.filter((item) => sourceLabels.has(item.label)),
  };
}

function SupplyRecommendationSection({ items }: { items: SupplyRankItem[] }) {
  return (
    <div className="print-section mb-8">
      <SectionHeading title="추천 공급유형" description="입력 조건과 공고 정보를 바탕으로 우선 검토할 공급유형입니다." />
      <Card className="mt-4 !rounded-[22px] !border-[#e3ded4] bg-white">
        {items.length > 0 ? (
          <div className="divide-y divide-[#ece6dc]">
            {items.map((item) => (
              <SupplyRankRow key={`${item.rank}-${item.type}`} item={item} />
            ))}
          </div>
        ) : (
          <div className="px-5 py-6 text-[14px] text-[#6e6e73]">추천 공급유형 데이터가 아직 없습니다.</div>
        )}
      </Card>
    </div>
  );
}

function SupplyRankRow({ item }: { item: SupplyRankItem }) {
  return (
    <div className="grid gap-4 px-5 py-5 md:grid-cols-[48px_minmax(0,1fr)_auto] md:items-start">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f5ff] text-[14px] font-black text-[#0b5bd3]">
        {item.rank}
      </div>
      <div className="min-w-0">
        <h4 className="text-[17px] font-black text-[#152846] break-keep">{item.type}</h4>
        <p className="mt-1 text-[14px] leading-7 text-[#596273]">{item.desc}</p>
        {item.matchedItems.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.matchedItems.slice(0, 5).map((matched) => (
              <span key={matched} className="rounded-full bg-[#f4fbf6] px-2.5 py-1 text-[11px] font-bold text-[#237a3f]">
                {matched}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className={`self-start rounded-full px-3 py-1.5 text-[12px] font-black ${chanceClassName(item.chance)}`}>
        {item.chance}
      </span>
    </div>
  );
}

function FinancePanel({ finance }: { finance: NonNullable<ReturnType<typeof normalizeFinance>> }) {
  const riskText = [
    finance.riskLevel,
    formatRatio(finance.riskRatio),
  ].filter(Boolean).join(" · ") || "확인 필요";

  return (
    <div>
      <SectionHeading title="재무 분석" description="분양가와 예상 자금 부담을 요약했습니다." />
      <Card className="mt-4 !rounded-[22px] !border-[#e3ded4] bg-white p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FinanceMetric label="분양가" value={formatWon(finance.price)} strong />
          <FinanceMetric label="실투자금" value={formatWon(finance.realInvestment)} strong />
          <FinanceMetric label="대출 가능 금액" value={formatWon(finance.loanAmount)} />
          <FinanceMetric label="적용 LTV" value={formatRatio(finance.ltvRate) ?? "확인 필요"} />
          <FinanceMetric label="지역 구분" value={finance.areaType ?? "확인 필요"} />
          <FinanceMetric label="자금 위험도" value={riskText} />
        </div>
      </Card>
    </div>
  );
}

function FinanceMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-[16px] border px-4 py-3.5 ${strong ? "border-[#d8c9b5] bg-[#fbf7ef]" : "border-[#ece6dc] bg-[#fffefa]"}`}>
      <p className="text-[12px] font-bold text-[#7a818c]">{label}</p>
      <p className={`mt-1 break-words font-black ${strong ? "text-[20px] text-[#102e5a]" : "text-[17px] text-[#26364e]"}`}>
        {value}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="px-1">
      {eyebrow && (
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#b86a12]">
          {eyebrow}
        </p>
      )}
      <h3 className={`${eyebrow ? "mt-1" : ""} text-[21px] font-black text-[#152846]`}>{title}</h3>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-[#69717d]">{description}</p>}
    </div>
  );
}

const checkFieldLabels: Record<string, string> = {
  has_income_tax_5_years: "소득세 납부 이력",
  monthly_household_income_krw: "월평균 가구소득",
  is_dual_income: "맞벌이 여부",
  total_assets_krw: "총자산",
  real_estate_assets_krw: "부동산 자산",
  vehicle_value_krw: "차량 가액",
  dependent_family_count: "부양가족 수",
  household_member_count: "세대원 수",
  homeless_period_years: "무주택 기간",
  residence_period_years: "거주 기간",
  bankbook_join_date: "청약통장 가입일",
  bankbook_payment_count: "청약통장 납입 횟수",
  bankbook_balance_krw: "청약통장 예치금",
  marriage_period_years: "혼인 기간",
  minor_child_count: "미성년 자녀 수",
};

function ProfileSnapshotDialog({
  items,
  onClose,
}: {
  items: ProfileSummaryItem[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-snapshot-title"
      onMouseDown={onClose}
      onKeyDown={handleDialogKeyDown}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-2xl overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#eceff3] px-6 py-5">
          <div>
            <p className="text-[12px] font-bold text-[#0b5bd3]">PROFILE SNAPSHOT</p>
            <h3 id="profile-snapshot-title" className="mt-1 text-[20px] font-bold text-[#1d1d1f]">
              내 프로필
            </h3>
            <p className="mt-1 text-[13px] leading-relaxed text-[#6e6e73]">
              이 진단 결과를 만들 때 저장된 프로필 기준입니다.
            </p>
          </div>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f5f7] text-[#4d5562] transition-colors hover:bg-[#e8ebef]"
            onClick={onClose}
            aria-label="프로필 팝업 닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="grid max-h-[62vh] grid-cols-1 gap-3 overflow-y-auto p-6 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="min-w-0 rounded-[14px] bg-[#f7f8fa] px-4 py-3">
              <dt className="text-[12px] font-semibold text-[#7a818c]">{item.label}</dt>
              <dd className="mt-1 break-words text-[14px] font-semibold text-[#26364e]">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex justify-end border-t border-[#eceff3] px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
}

function CheckDetailsToggle({
  title,
  items,
  emptyMessage,
  tone,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
  tone: "success" | "warning";
}) {
  const keywords = uniqueStrings(
    items.flatMap((item) => extractCheckKeywords(item)),
  ).slice(0, 8);
  const toneClass =
    tone === "success"
      ? "border-[#bfe5ca] bg-[#f4fbf6] text-[#237a3f]"
      : "border-[#f1d5a6] bg-[#fff9ef] text-[#a45f0b]";

  return (
    <details className="group overflow-hidden rounded-[18px] border border-[#e1e5ea] bg-white">
      <summary className="list-none cursor-pointer px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-[15px] text-[#26364e]">{title}</h4>
              <span className="rounded-full bg-[#f0f2f5] px-2.5 py-1 text-[11px] font-semibold text-[#68717d]">
                {items.length}개
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {keywords.length > 0 ? (
                keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className={`rounded-[9px] border px-2.5 py-1.5 text-[12px] font-semibold ${toneClass}`}
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-[12px] text-[#8a9099]">추가 항목 없음</span>
              )}
            </div>
          </div>
          <ChevronDown className="h-5 w-5 shrink-0 text-[#7a818c] transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[#eceff3] px-5 py-4">
        {items.length > 0 ? (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] leading-6 text-[#596273]">
                <CheckCircle2 className={`mt-1 h-4 w-4 shrink-0 ${tone === "success" ? "text-[#2d8a54]" : "text-[#d98216]"}`} />
                <span>{formatCheckDescription(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-[#7a818c]">{emptyMessage}</p>
        )}
      </div>
    </details>
  );
}

function extractCheckKeywords(item: string) {
  const normalized = item.toLowerCase();
  const fieldKeywords = Object.entries(checkFieldLabels)
    .filter(([field]) => normalized.includes(field.toLowerCase()))
    .map(([, label]) => label);

  if (fieldKeywords.length > 0) return fieldKeywords;

  const semanticKeywords = [
    "청약통장",
    "무주택",
    "거주",
    "소득",
    "자산",
    "부양가족",
    "세대주",
    "특별공급",
    "대출",
    "분양가",
  ].filter((keyword) => item.includes(keyword));

  if (semanticKeywords.length > 0) return semanticKeywords;

  const prefix = stripMarkdown(item)
    .replace(/^[-*•]\s*/, "")
    .split(/[:：,]/)[0]
    .trim();
  return prefix ? [prefix.length > 18 ? `${prefix.slice(0, 18)}…` : prefix] : [];
}

function formatCheckDescription(item: string) {
  return Object.entries(checkFieldLabels).reduce(
    (text, [field, label]) => text.split(field).join(label),
    stripMarkdown(item),
  );
}

function buildResultViewModel(result: UnknownRecord | null) {
  const payload = asRecord(result?.result_payload) ?? {};
  const report = asRecord(result?.report) ?? asRecord(payload.report) ?? asRecord(asRecord(payload.node6)?.final_report) ?? {};
  const announcement = asRecord(result?.announcement_confirmed) ?? asRecord(payload.announcement) ?? {};
  const profileSnapshot = asRecord(asRecord(result?.input_snapshot)?.profile) ?? asRecord(result?.profile) ?? {};
  const supplyRank = normalizeSupplyRank(payload.supply_rank ?? report.supply_rank ?? result?.supply_rank);
  const missingItems = collectMissingItems(result, payload, supplyRank);
  const analysisItems = collectAnalysisItems(report, payload, supplyRank);
  const resultStatus = stringValue(payload.status) ?? stringValue(result?.overall_analysis_status);
  const finance = normalizeFinance(report, payload);
  const announcementPresentation = getAnnouncementPresentation({
    diagnosis_mode: result?.diagnosis_mode,
    announcement_confirmed: announcement,
    input_snapshot: result?.input_snapshot,
  });
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
    title: announcementPresentation.title,
    announcementInfo: announcementPresentation.info,
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
    profileSummaryItems: buildProfileSummaryItems(profileSnapshot),
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
      // FastAPI 내부는 missing_items, Django 공개 계약은 missing_fields를 사용한다.
      // 통합 과도기에는 둘 다 읽어 실제 추가 확인 항목이 화면에서 누락되지 않게 한다.
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

  // 실제 백엔드(financial.py analyze_financial_risk)가 만들어내는 필드는
  // summary/message가 아니라 description(문장)과 action_items(행동지침 목록)임.
  // 예전 코드는 존재하지 않는 필드만 찾고 있어서 상세 진단에서도 항상 비어있었음.
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

function buildProfileSummaryItems(profile: UnknownRecord): ProfileSummaryItem[] {
  return [
    { label: "거주 지역", value: formatProfileText(formatRegionTag(stringValue(profile.residence_region))) },
    { label: "주택 상태", value: formatProfileText(booleanText(profile.is_homeless, "무주택", "유주택")) },
    { label: "세대주 여부", value: formatProfileText(booleanText(profile.is_household_head, "세대주", "세대원")) },
    { label: "세대원 수", value: formatProfileText(formatCount(profile.household_member_count, "명")) },
    { label: "출생 연도", value: formatProfileText(formatYearValue(profile.birth_year)) },
    { label: "혼인 상태", value: formatProfileText(formatMaritalStatus(stringValue(profile.marital_status))) },
    { label: "미성년 자녀 수", value: formatProfileText(formatCount(profile.minor_child_count, "명")) },
    { label: "부양가족 수", value: formatProfileText(formatCount(profile.dependent_family_count, "명")) },
    { label: "무주택 기간", value: formatProfileText(formatCount(profile.homeless_period_years, "년")) },
    { label: "거주 기간", value: formatProfileText(formatCount(profile.residence_period_years, "년")) },
    { label: "청약통장 유형", value: formatProfileText(formatBankbookType(stringValue(profile.bankbook_type))) },
    { label: "통장 가입일", value: formatProfileText(stringValue(profile.bankbook_join_date)) },
    { label: "납입 횟수", value: formatProfileText(formatCount(profile.bankbook_payment_count, "회")) },
    { label: "예치금", value: formatProfileText(formatProfileWon(profile.bankbook_balance_krw)) },
    { label: "저축액", value: formatProfileText(formatProfileWon(profile.savings_amount_krw)) },
    { label: "월평균 가구소득", value: formatProfileText(formatProfileWon(profile.monthly_household_income_krw)) },
    { label: "총자산", value: formatProfileText(formatProfileWon(profile.total_assets_krw)) },
  ];
}

function formatProfileText(value?: string) {
  return value ?? "미입력";
}

function booleanText(value: unknown, trueText: string, falseText: string) {
  if (value === true) return trueText;
  if (value === false) return falseText;
  return undefined;
}

function formatRegionTag(value?: string) {
  if (!value) return undefined;
  const regionMap: Record<string, string> = {
    SEOUL: "서울특별시",
    GYEONGGI: "경기도",
    INCHEON: "인천광역시",
    BUSAN: "부산광역시",
    DAEGU: "대구광역시",
    DAEJEON: "대전광역시",
    GWANGJU: "광주광역시",
    ULSAN: "울산광역시",
    SEJONG: "세종특별자치시",
    OTHER: "그 외 지역",
  };
  return regionMap[value] ?? value.replace(/_/g, " ");
}

function formatMaritalStatus(value?: string) {
  if (!value) return undefined;
  const maritalStatusMap: Record<string, string> = {
    SINGLE: "미혼",
    MARRIED: "기혼",
    UNKNOWN: "기타",
  };
  return maritalStatusMap[value] ?? value.replace(/_/g, " ");
}

function formatBankbookType(value?: string) {
  if (!value) return undefined;
  const bankbookTypeMap: Record<string, string> = {
    HOUSING_SUBSCRIPTION_COMPREHENSIVE: "주택청약종합저축",
    SUBSCRIPTION_SAVINGS: "청약저축",
    SUBSCRIPTION_DEPOSIT: "청약예금",
    SUBSCRIPTION_INSTALLMENT: "청약부금",
    UNKNOWN: "모름",
  };
  return bankbookTypeMap[value] ?? value.replace(/_/g, " ");
}

function formatYearValue(value: unknown) {
  const year = numberValue(value);
  return year !== undefined ? `${year}년` : undefined;
}

function formatCount(value: unknown, unit: string) {
  const count = numberValue(value);
  return count !== undefined ? `${count}${unit}` : undefined;
}

function formatProfileWon(value: unknown) {
  const amount = numberValue(value);
  return amount !== undefined ? formatWon(amount) : undefined;
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

function formatDateTime(value: string) {
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
