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
  assert.match(mapper, /NETWORK_ERROR/);
  assert.match(mapper, /502:/);
  assert.match(mapper, /504:/);
  assert.match(mapper, /error\.status >= 500/);
  assert.match(ui, /getErrorPresentation/);
  assert.match(ui, /details/);
});

test("chatbot keeps messages and backend session id in browser session storage", () => {
  const source = readSource("components/ChatbotPanel.tsx");

  assert.match(source, /CHAT_MESSAGES_STORAGE_KEY/);
  assert.match(source, /CHAT_SESSION_STORAGE_KEY/);
  assert.match(source, /DEPOSIT_SAVINGS_QUESTION/);
  assert.match(source, /청약에서 예치금과 저축액의 차이는 무엇인가요\?/);
  assert.match(source, /withDepositSavingsQuestion/);
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
  assert.match(header, /label: "마이페이지"/);
  assert.match(header, /\{ path: "\/chatbot", label:/);
  assert.match(routes, /\{ path: "\/chatbot", Component: ChatbotPage \}/);
  assert.match(layout, /FloatingChatbot/);
  assert.match(layout, /MessageCircle/);
  assert.match(layout, /aria-expanded=\{isOpen\}/);
  assert.match(layout, /aria-controls=\{isOpen \? panelId : undefined\}/);
  assert.match(layout, /role="dialog"/);
  assert.match(layout, /aria-label="청약 상담 챗봇"/);
  assert.match(layout, /챗봇 열기/);
  assert.doesNotMatch(layout, /<aside/);
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
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-selected=\{isActive\}/);
  assert.match(source, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(source, /좌우 방향키/);
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
  assert.match(source, /displayTags\.slice\(0, 4\)/);
  assert.match(source, /프로필 입력 필요/);
  assert.match(source, /latestProfileOnlyGroup \? formatDateOnly\(latestProfileOnlyGroup\.latestCreatedAt\) : "현재 기준"/);
  assert.match(source, /isBasicDiagnosisRunning/);
  assert.match(source, /profile_only: true/);
  assert.match(source, /진단 중\.\.\./);
  assert.match(source, /공고 기반 분석은 아파트명 단위로 묶어 확인합니다/);
  assert.match(source, /공고 기반 분석 기록이 없습니다/);
  assert.match(source, /조건 변경/);
  assert.match(source, /변경: \{change\}/);
  assert.match(source, /AccountOverviewCard/);
  assert.match(source, /AccountManagementDialog/);
  assert.match(source, /api\.changePassword/);
  assert.match(source, /api\.deleteAccount/);
  assert.match(source, /계정 관리/);
  assert.match(source, /정말 삭제하시겠습니까\?/);
  assert.match(source, /최종 삭제/);
  assert.match(source, /기본 진단/);
  assert.match(source, /date_joined/);
  assert.doesNotMatch(source, /Basic Report/);
  assert.doesNotMatch(source, /function ProfileOnlySection/);
  assert.doesNotMatch(source, /새로고침/);
  assert.doesNotMatch(source, /분석 실행/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.doesNotMatch(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /snap-x/);
  assert.doesNotMatch(source, /PDF 공고 기반/);
});

test("long-running work has duplicate-request guards, loading UI, and timeout handling", () => {
  const strategy = readSource("pages/StrategyRun.tsx");
  const strategyInput = readSource("pages/strategy-run/PdfAnnouncementInputCard.tsx");
  const strategyProfile = readSource("pages/strategy-run/StrategyProfileSummary.tsx");
  const progressStages = readSource("pages/strategy-run/progressStages.ts");
  const pdf = readSource("pages/PdfAnalysis.tsx");
  const ui = readSource("components/UI.tsx");
  const announcementPresentation = readSource("utils/announcementPresentation.ts");
  const resultDetail = readSource("pages/ResultDetail.tsx");

  assert.match(strategy, /if \(isBusy\) return/);
  assert.match(strategy, /new AbortController\(\)/);
  assert.match(strategy, /controller\.abort\(\)/);
  assert.match(strategyProfile, /disabled=\{isBusy/);
  assert.match(strategy, /STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /sessionStorage\.setItem\(STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /api\.analyzePdf\(file\)/);
  assert.match(strategy, /pdfWarnings/);
  assert.match(strategyInput, /PDF 분석 확인 필요/);
  assert.match(announcementPresentation, /inputAnnouncement\.display_title/);
  assert.match(announcementPresentation, /cleanAnnouncementTitle\(displayTitle\)/);
  assert.match(announcementPresentation, /아파트\\s\*청약\\s\*진단용/);
  assert.match(announcementPresentation, /공고명\\s\*\[:：\]\?\\s\*확인\\s\*필요/);
  assert.match(strategy, /isPdfDragging/);
  assert.match(strategy, /getPdfUploadStage/);
  assert.match(strategyInput, /여기에 PDF를 드롭하세요/);
  assert.match(progressStages, /Backend progress events are not exposed yet/);
  assert.match(strategyInput, /onDragEnter=\{onPdfDragEnter\}/);
  assert.match(strategy, /handlePdfDragOver/);
  assert.match(strategy, /dropEffect = isBusy \? "none" : "copy"/);
  assert.match(strategyInput, /onDragOver=\{onPdfDragOver\}/);
  assert.match(strategyInput, /onDragLeave=\{onPdfDragLeave\}/);
  assert.match(strategyInput, /onDrop=\{onPdfDrop\}/);
  assert.doesNotMatch(strategy, /PDF 파일로 분석하기/);
  assert.doesNotMatch(strategy, />\s*파일 선택\s*</);
  assert.match(pdf, /isUploading/);
  assert.match(pdf, /ProcessingIndicator/);
  assert.match(ui, /animate-spin/);
  assert.match(resultDetail, /PDF로 저장/);
  assert.match(resultDetail, /window\.print\(\)/);
  assert.match(resultDetail, /@page/);
  assert.match(resultDetail, /size: A4/);
  assert.match(resultDetail, /ReportHeader/);
  assert.match(resultDetail, /AFIT REPORT/);
  assert.match(resultDetail, /ReportMetric/);
  assert.match(resultDetail, /AnnouncementInfoPanel/);
  assert.match(resultDetail, /groupAnnouncementInfo/);
  assert.match(resultDetail, /AnnouncementMetric/);
  assert.match(resultDetail, /Schedule/);
  assert.match(resultDetail, /SupplyRecommendationSection/);
  assert.match(resultDetail, /FinancePanel/);
  assert.match(resultDetail, /body header/);
  assert.match(resultDetail, /body aside/);
  assert.match(resultDetail, /이용 안내 및 면책 조항/);
  assert.match(resultDetail, /참고용 진단/);
  assert.match(resultDetail, /no-print/);
  assert.match(resultDetail, /isProfileDialogOpen/);
  assert.match(resultDetail, /UserFloatingIcon/);
  assert.match(resultDetail, /내 프로필/);
  assert.match(resultDetail, /다시 진단하기/);
  assert.match(resultDetail, /ProfileSnapshotDialog/);
  assert.match(resultDetail, /role="dialog"/);
  assert.match(resultDetail, /handleDialogKeyDown/);
  assert.match(resultDetail, /event\.key === "Escape"/);
  assert.match(resultDetail, /firstFocusable\?\.focus\(\)/);
  assert.match(resultDetail, /input_snapshot\)\?\.profile/);
  assert.match(resultDetail, /buildProfileSummaryItems/);
});
