// 역할: 마이페이지/결과 상세에서 진단 이력의 공고 제목과 기본정보를 표시용으로 정리합니다.
// 흐름: StrategyRun 저장 snapshot -> Django StrategyRunSerializer -> MyPage/ResultDetail -> getAnnouncementPresentation.
// PDF 기반 진단은 input_snapshot.announcement.pdf_extracted_fields를 우선 사용합니다.
type UnknownRecord = Record<string, unknown>;

type AnnouncementSource = {
  diagnosis_mode?: unknown;
  announcement_confirmed?: unknown;
  input_snapshot?: unknown;
};

export type AnnouncementInfoItem = {
  label: string;
  value: string;
};

export type AnnouncementPresentation = {
  title: string;
  sourceFilename?: string;
  info: AnnouncementInfoItem[];
};

const regionLabels: Record<string, string> = {
  SEOUL: "서울",
  GYEONGGI: "경기",
  INCHEON: "인천",
  BUSAN: "부산",
  DAEGU: "대구",
  DAEJEON: "대전",
  GWANGJU: "광주",
  ULSAN: "울산",
  SEJONG: "세종",
};

const supplyLabels: Record<string, string> = {
  PRIVATE: "민영주택",
  PUBLIC: "공공주택",
  PRIVATE_HOUSING: "민영주택",
  PUBLIC_HOUSING: "공공주택",
};

export function getAnnouncementPresentation(
  strategy: AnnouncementSource,
): AnnouncementPresentation {
  const inputSnapshot = asRecord(strategy.input_snapshot);
  const inputAnnouncement = asRecord(inputSnapshot?.announcement) ?? {};
  const announcement = asRecord(strategy.announcement_confirmed) ?? {};
  const pdfFields = asRecord(inputAnnouncement.pdf_extracted_fields) ?? {};
  const sourceFilename = stringValue(inputAnnouncement.source_filename);
  const announcementText = stringValue(inputAnnouncement.announcement_text);
  const isProfileOnly =
    strategy.diagnosis_mode === "PROFILE_ONLY" ||
    inputAnnouncement.profile_only === true ||
    (!announcementText && Object.keys(announcement).length === 0);

  const title = isProfileOnly
    ? "청약 가능성 분석"
    : firstDefined(
        cleanAnnouncementTitle(stringValue(pdfFields.announcement_name)),
        cleanAnnouncementTitle(stringValue(announcement.announcement_name)),
        cleanAnnouncementTitle(stringValue(inputAnnouncement.announcement_name)),
        extractTitleFromText(announcementText),
        cleanFilename(sourceFilename),
        "아파트 분양 공고 진단",
      );

  const info = isProfileOnly
    ? [{ label: "진단 기준", value: "저장된 내 청약 조건" }]
    : buildAnnouncementInfo(announcement, pdfFields, sourceFilename, announcementText);

  return {
    title,
    sourceFilename,
    info,
  };
}

function buildAnnouncementInfo(
  announcement: UnknownRecord,
  pdfFields: UnknownRecord,
  sourceFilename?: string,
  announcementText?: string,
): AnnouncementInfoItem[] {
  const region =
    stringValue(pdfFields.location) ??
    formatRegion(stringValue(announcement.region)) ??
    findLabeledValue(announcementText, ["공급 위치", "공급지역", "지역"]);
  const supply =
    formatHousingCategory(stringValue(pdfFields.housing_category)) ??
    supplyLabels[stringValue(announcement.supply_category) ?? ""] ??
    supplyLabels[stringValue(announcement.housing_type) ?? ""] ??
    findLabeledValue(announcementText, ["공급 유형", "공급유형", "주택 유형", "주택유형"]);
  const exclusiveArea = numberValue(announcement.exclusive_area_sqm);
  const area =
    formatHousingTypes(pdfFields.housing_types) ??
    (exclusiveArea !== undefined
      ? `${exclusiveArea}㎡`
      : formatAreaText(stringValue(announcement.area_text)) ??
        findLabeledValue(announcementText, ["전용면적", "전용 면적"]));
  const price =
    formatPriceSummary(pdfFields.price_summary) ??
    formatWon(numberValue(announcement.sale_price_krw)) ??
    findLabeledValue(announcementText, ["분양가", "공급금액"]);
  const households = numberValue(announcement.supply_household_count);
  const householdText =
    formatSupplySummary(pdfFields.supply_summary) ??
    (households !== undefined
      ? `${households.toLocaleString("ko-KR")}세대`
      : findLabeledValue(announcementText, ["공급 세대수", "공급세대수", "공급 세대"]));
  const schedule = asRecord(pdfFields.schedule) ?? {};
  const startDate = stringValue(announcement.application_start_date);
  const endDate = stringValue(announcement.application_end_date);
  const applicationPeriod =
    formatApplicationSchedule(schedule) ??
    (startDate && endDate
      ? `${startDate} ~ ${endDate}`
      : startDate ??
        endDate ??
        findLabeledValue(announcementText, ["청약 접수 기간", "청약접수기간", "접수 기간"]));
  const winnerDate = stringValue(schedule.winner_announcement);
  const announcementDate =
    stringValue(pdfFields.announcement_date) ??
    findLabeledValue(
      announcementText,
      ["입주자 모집공고일", "입주자모집공고일", "모집공고일"],
    );

  return [
    region ? { label: "공급 지역", value: region } : undefined,
    supply ? { label: "공급 유형", value: supply } : undefined,
    area ? { label: "주택형", value: area } : undefined,
    price ? { label: "공급금액", value: price } : undefined,
    householdText ? { label: "공급 세대", value: householdText } : undefined,
    applicationPeriod
      ? { label: "청약 접수", value: applicationPeriod }
      : undefined,
    winnerDate
      ? { label: "당첨자 발표", value: winnerDate }
      : undefined,
    announcementDate
      ? { label: "모집공고일", value: announcementDate }
      : undefined,
    sourceFilename
      ? { label: "공고 파일", value: sourceFilename }
      : undefined,
  ].filter((item): item is AnnouncementInfoItem => Boolean(item));
}

function findLabeledValue(text: string | undefined, labels: string[]) {
  if (!text) return undefined;
  const escapedLabels = labels.map((label) =>
    label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const pattern = new RegExp(
    `(?:^|\\n)\\s*(?:${escapedLabels.join("|")})\\s*[:：]\\s*([^\\n]+)`,
    "i",
  );
  const match = text.replace(/\r/g, "").match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim() || undefined;
}

function extractTitleFromText(text?: string) {
  if (!text) return undefined;

  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 80);

  for (const line of lines) {
    const labeled = line.match(
      /^(?:공고명|단지명|아파트명|주택명|사업명)\s*[:：]\s*(.+)$/i,
    );
    if (labeled) {
      const cleaned = cleanAnnouncementTitle(labeled[1]);
      if (cleaned) return cleaned;
    }
  }

  const announcementLine = lines.find(
    (line) =>
      line.length <= 100 &&
      /(아파트|자이|힐스테이트|푸르지오|래미안|아이파크|롯데캐슬|더샵|e편한세상).*(입주자\s*모집공고|분양\s*공고)/i.test(line),
  );

  return cleanAnnouncementTitle(announcementLine);
}

function formatHousingCategory(value?: string) {
  if (!value) return undefined;
  if (value === "PRIVATE") return "민영주택";
  if (value === "PUBLIC") return "공공주택";
  return value;
}

function formatHousingTypes(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const types = value
    .map((item) => asRecord(item))
    .map((item) => stringValue(item?.type) ?? stringValue(item?.full_type))
    .filter((item): item is string => Boolean(item));

  if (types.length === 0) return undefined;
  if (types.length <= 5) return types.join(", ");
  return `${types[0]}~${types[types.length - 1]}형 (${types.length}개 주택형)`;
}

function formatPriceSummary(value: unknown) {
  const price = asRecord(value);
  const min = numberValue(price?.min_krw);
  const max = numberValue(price?.max_krw);

  if (min !== undefined && max !== undefined) {
    return `약 ${formatHundredMillionWon(min)}~${formatHundredMillionWon(max)}`;
  }
  return formatWon(min ?? max);
}

function formatSupplySummary(value: unknown) {
  const supply = asRecord(value);
  const total = numberValue(supply?.total_households);
  const general = numberValue(supply?.general_supply_households);
  const special = numberValue(supply?.special_supply_households);
  const parts = [
    total !== undefined ? `총 ${total.toLocaleString("ko-KR")}세대` : undefined,
    general !== undefined ? `일반 ${general.toLocaleString("ko-KR")}세대` : undefined,
    special !== undefined ? `특별공급 ${special.toLocaleString("ko-KR")}세대` : undefined,
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(", ") : undefined;
}

function formatApplicationSchedule(schedule: UnknownRecord) {
  const special = stringValue(schedule.special_supply);
  const first = stringValue(schedule.first_priority);
  const second = stringValue(schedule.second_priority);
  const parts = [
    special ? `특별 ${special}` : undefined,
    first ? `1순위 ${first}` : undefined,
    second ? `2순위 ${second}` : undefined,
  ].filter((item): item is string => Boolean(item));

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function cleanFilename(filename?: string) {
  if (!filename) return undefined;
  return cleanAnnouncementTitle(
    filename
      .replace(/\.(pdf|hwp|hwpx|docx?)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/^(공고문|입주자\s*모집공고)\s*/i, ""),
  );
}

function cleanAnnouncementTitle(value?: string) {
  if (!value) return undefined;

  const cleaned = value
    .replace(/\.(pdf|hwp|hwpx|docx?)$/i, "")
    .replace(/\s*(?:입주자\s*모집공고|분양\s*공고|모집공고문)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || undefined;
}

function formatRegion(value?: string) {
  if (!value) return undefined;
  return value
    .split("_")
    .map((part) => regionLabels[part] ?? part)
    .join(" ");
}

function formatAreaText(value?: string) {
  if (!value) return undefined;
  return value.replace(/_SQM$/i, "㎡").replace(/_/g, " ");
}

function formatWon(value?: number) {
  return value === undefined ? undefined : `${value.toLocaleString("ko-KR")}원`;
}

function formatHundredMillionWon(value: number) {
  const hundredMillion = value / 100000000;
  return `${hundredMillion.toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
  })}억원`;
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value): value is string => Boolean(value)) ?? "";
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
