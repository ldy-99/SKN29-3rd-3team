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
  const sourceFilename = stringValue(inputAnnouncement.source_filename);
  const announcementText = stringValue(inputAnnouncement.announcement_text);
  const isProfileOnly =
    strategy.diagnosis_mode === "PROFILE_ONLY" ||
    inputAnnouncement.profile_only === true ||
    (!announcementText && Object.keys(announcement).length === 0);

  const title = isProfileOnly
    ? "공고 없이 진행한 청약 진단"
    : firstDefined(
        cleanAnnouncementTitle(stringValue(announcement.announcement_name)),
        extractTitleFromText(announcementText),
        cleanFilename(sourceFilename),
        "아파트 분양 청약 진단",
      );

  const info = isProfileOnly
    ? [{ label: "진단 기준", value: "저장된 내 청약 조건" }]
    : buildAnnouncementInfo(announcement, sourceFilename, announcementText);

  return {
    title,
    sourceFilename,
    info,
  };
}

function buildAnnouncementInfo(
  announcement: UnknownRecord,
  sourceFilename?: string,
  announcementText?: string,
): AnnouncementInfoItem[] {
  const region =
    formatRegion(stringValue(announcement.region)) ??
    findLabeledValue(announcementText, ["공급 위치", "공급지역", "지역"]);
  const supply =
    supplyLabels[stringValue(announcement.supply_category) ?? ""] ??
    supplyLabels[stringValue(announcement.housing_type) ?? ""] ??
    findLabeledValue(announcementText, ["공급 유형", "공급유형", "주택 유형", "주택유형"]);
  const exclusiveArea = numberValue(announcement.exclusive_area_sqm);
  const area =
    exclusiveArea !== undefined
      ? `${exclusiveArea}㎡`
      : formatAreaText(stringValue(announcement.area_text)) ??
        findLabeledValue(announcementText, ["전용면적", "전용 면적"]);
  const price =
    formatWon(numberValue(announcement.sale_price_krw)) ??
    findLabeledValue(announcementText, ["분양가", "공급금액"]);
  const households = numberValue(announcement.supply_household_count);
  const householdText =
    households !== undefined
      ? `${households.toLocaleString("ko-KR")}세대`
      : findLabeledValue(announcementText, ["공급 세대수", "공급세대수", "공급 세대"]);
  const startDate = stringValue(announcement.application_start_date);
  const endDate = stringValue(announcement.application_end_date);
  const applicationPeriod =
    startDate && endDate
      ? `${startDate} ~ ${endDate}`
      : startDate ??
        endDate ??
        findLabeledValue(announcementText, ["청약 접수 기간", "청약접수기간", "접수 기간"]);
  const announcementDate = findLabeledValue(
    announcementText,
    ["입주자 모집공고일", "입주자모집공고일", "모집공고일"],
  );

  return [
    region ? { label: "공급 지역", value: region } : undefined,
    supply ? { label: "공급 유형", value: supply } : undefined,
    area ? { label: "전용면적", value: area } : undefined,
    price ? { label: "분양가", value: price } : undefined,
    householdText ? { label: "공급 세대", value: householdText } : undefined,
    applicationPeriod
      ? { label: "청약 접수", value: applicationPeriod }
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
