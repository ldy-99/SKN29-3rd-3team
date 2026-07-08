import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(testDirectory, "..", "src", "app");

function readSource(relativePath) {
  return readFileSync(join(sourceRoot, relativePath), "utf8");
}

test("login and signup use the real auth API with password confirmation", () => {
  const source = readSource("pages/Login.tsx");

  assert.match(source, /api\.login\(\{ email, password \}\)/);
  assert.match(source, /api\.signup\(\{ email, password \}\)/);
  assert.match(source, /passwordConfirm/);
  assert.match(source, /setAuthenticatedUser\(user\)/);
});

test("protected layout checks authentication and redirects anonymous users", () => {
  const layout = readSource("components/Layout.tsx");
  const authContext = readSource("auth/AuthContext.tsx");
  const apiClient = readSource("api/client.ts");

  assert.match(layout, /if \(!user\)/);
  assert.match(layout, /<Navigate to="\/login" replace/);
  assert.match(authContext, /api\.getMe\(\)/);
  assert.match(apiClient, /credentials:\s*"include"/);
});

test("profile form exposes dependent fields from base values", () => {
  const source = readSource("pages/Profile.tsx");

  assert.match(source, /showMarriageDetails\s*=\s*profile\.marital_status === "MARRIED"/);
  assert.match(source, /showHomelessPeriod\s*=\s*profile\.is_homeless === true/);
  assert.match(source, /showChildDetails\s*=\s*\(profile\.minor_child_count \?\? 0\) > 0/);
  assert.match(source, /\{showMarriageDetails && \(/);
  assert.match(source, /\{showChildDetails && \(/);
  assert.match(source, /next\.marriage_period_years = null/);
  assert.match(source, /예치금 \(만원\)/);
  assert.match(source, /만원 단위로 입력하면 원 단위로 저장됩니다/);
  assert.match(source, /Math\.round\(value \/ 10000\)/);
  assert.match(source, /Number\(tenThousandWon\) \* 10000/);
  assert.match(source, /aria-label="만원 단위 금액"/);
});

test("API errors are presented with user-facing field details", () => {
  const mapper = readSource("api/errorPresentation.ts");
  const ui = readSource("components/UI.tsx");

  assert.match(mapper, /flattenFieldErrors/);
  assert.match(mapper, /fieldLabel/);
  assert.match(mapper, /field_errors/);
  assert.match(ui, /getErrorPresentation/);
});

test("chatbot keeps messages and backend session id in browser session storage", () => {
  const source = readSource("components/ChatbotPanel.tsx");

  assert.match(source, /CHAT_MESSAGES_STORAGE_KEY/);
  assert.match(source, /CHAT_SESSION_STORAGE_KEY/);
  assert.match(source, /sessionStorage\.setItem\(CHAT_MESSAGES_STORAGE_KEY/);
  assert.match(source, /sessionStorage\.setItem\(CHAT_SESSION_STORAGE_KEY/);
  assert.match(source, /session_id: chatSessionId/);
});

test("mobile navigation and chatbot-only route are available", () => {
  const header = readSource("components/SiteHeader.tsx");
  const routes = readSource("routes.tsx");
  const layout = readSource("components/Layout.tsx");

  assert.match(header, /aria-label=/);
  assert.match(header, /lg:hidden/);
  assert.match(header, /\{ path: "\/chatbot", label:/);
  assert.match(routes, /\{ path: "\/chatbot", Component: ChatbotPage \}/);
  assert.match(layout, /hidden xl:block/);
});

test("my page groups announcement reports into cards with a history dialog", () => {
  const source = readSource("pages/MyPage.tsx");

  assert.match(source, /buildHistoryEntries/);
  assert.match(source, /buildProfileOnlyGroups/);
  assert.match(source, /ReportCarousel/);
  assert.match(source, /CarouselItemCard/);
  assert.match(source, /AnnouncementCarouselCard/);
  assert.match(source, /ProfileSummaryBar/);
  assert.match(source, /buildProfileSnapshotKey/);
  assert.match(source, /buildProfileTags/);
  assert.match(source, /buildProfileChangeBadges/);
  assert.match(source, /AfitCardBack/);
  assert.match(source, /HistoryDialog/);
  assert.match(source, /History/);
  assert.match(source, /handleNativeWheel/);
  assert.match(source, /handleCarouselKeyDown/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /Math\.abs\(offset\) > 1/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /addEventListener\("wheel", handleNativeWheel, \{ passive: false \}\)/);
  assert.match(source, /removeEventListener\("wheel", handleNativeWheel\)/);
  assert.match(source, /movement > 0 \? 1 : -1/);
  assert.match(source, /<picture>/);
  assert.match(source, /afit-card-back_270x390\.png/);
  assert.match(source, /afit-card-back_300x430\.png/);
  assert.match(source, /object-fill/);
  assert.match(source, /bookend-start/);
  assert.match(source, /bookend-end/);
  assert.match(source, /reportCardFlipIn/);
  assert.match(source, /Select Report/);
  assert.match(source, /레포트 보기/);
  assert.match(source, /\{group\.items\.length\}회/);
  assert.match(source, /레포트 생성/);
  assert.match(source, /최근 생성/);
  assert.match(source, /최근 \{formatDateOnly\(group\.latestCreatedAt\)\}/);
  assert.match(source, /h-\[84vh\] max-h-\[760px\]/);
  assert.match(source, /flex-1 overflow-y-auto/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /formatCompactLocation/);
  assert.match(source, /같은 공고문으로 생성된 분석 내역을 최근순으로 정리했습니다/);
  assert.match(source, /기본 정보 진단/);
  assert.match(source, /tags\.slice\(0, 4\)/);
  assert.match(source, /latestProfileOnlyGroup \? formatDateOnly\(latestProfileOnlyGroup\.latestCreatedAt\) : "현재 기준"/);
  assert.match(source, /결과 보기/);
  assert.match(source, /분석 실행/);
  assert.match(source, /공고 기반 분석은 아파트명 단위로 묶어 확인합니다/);
  assert.match(source, /공고 기반 분석 기록이 없습니다/);
  assert.match(source, /조건 변경/);
  assert.match(source, /변경: \{change\}/);
  assert.doesNotMatch(source, /Basic Report/);
  assert.doesNotMatch(source, /function ProfileOnlySection/);
  assert.match(source, /role="dialog"/);
  assert.doesNotMatch(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /snap-x/);
  assert.doesNotMatch(source, /PDF 공고 기반/);
});

test("long-running work has duplicate-request guards, loading UI, and timeout handling", () => {
  const strategy = readSource("pages/StrategyRun.tsx");
  const pdf = readSource("pages/PdfAnalysis.tsx");
  const ui = readSource("components/UI.tsx");
  const announcementPresentation = readSource("utils/announcementPresentation.ts");
  const resultDetail = readSource("pages/ResultDetail.tsx");

  assert.match(strategy, /if \(isBusy\) return/);
  assert.match(strategy, /new AbortController\(\)/);
  assert.match(strategy, /controller\.abort\(\)/);
  assert.match(strategy, /disabled=\{isBusy/);
  assert.match(strategy, /STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /sessionStorage\.setItem\(STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /api\.analyzePdf\(file\)/);
  assert.match(announcementPresentation, /inputAnnouncement\.display_title/);
  assert.match(announcementPresentation, /cleanAnnouncementTitle\(displayTitle\)/);
  assert.match(announcementPresentation, /아파트\\s\*청약\\s\*진단용/);
  assert.match(announcementPresentation, /공고명\\s\*\[:：\]\?\\s\*확인\\s\*필요/);
  assert.match(strategy, /isPdfDragging/);
  assert.match(strategy, /getPdfUploadStage/);
  assert.match(strategy, /여기에 PDF를 드롭하세요/);
  assert.match(strategy, /Backend progress events are not exposed yet/);
  assert.match(strategy, /onDragEnter=\{handlePdfDragEnter\}/);
  assert.match(strategy, /handlePdfDragOver/);
  assert.match(strategy, /dropEffect = isBusy \? "none" : "copy"/);
  assert.match(strategy, /onDragOver=\{handlePdfDragOver\}/);
  assert.match(strategy, /onDragLeave=\{handlePdfDragLeave\}/);
  assert.match(strategy, /onDrop=\{handlePdfDrop\}/);
  assert.doesNotMatch(strategy, /PDF 파일로 분석하기/);
  assert.doesNotMatch(strategy, />\s*파일 선택\s*</);
  assert.match(pdf, /isUploading/);
  assert.match(pdf, /ProcessingIndicator/);
  assert.match(ui, /animate-spin/);
  assert.match(resultDetail, /PDF로 저장/);
  assert.match(resultDetail, /window\.print\(\)/);
  assert.match(resultDetail, /이용 안내 및 면책 조항/);
  assert.match(resultDetail, /참고용 진단/);
  assert.match(resultDetail, /no-print/);
});
