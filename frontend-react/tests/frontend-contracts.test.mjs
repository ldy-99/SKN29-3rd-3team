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

test("로그인·회원가입 화면이 실제 인증 API와 비밀번호 확인을 사용한다", () => {
  const source = readSource("pages/Login.tsx");

  assert.match(source, /api\.login\(\{ email, password \}\)/);
  assert.match(source, /api\.signup\(\{ email, password \}\)/);
  assert.match(source, /passwordConfirm/);
  assert.match(source, /비밀번호와 비밀번호 확인이 일치하지 않습니다/);
  assert.match(source, /setAuthenticatedUser\(user\)/);
});

test("보호 화면은 인증 확인 후 비로그인 사용자를 로그인 화면으로 보낸다", () => {
  const layout = readSource("components/Layout.tsx");
  const authContext = readSource("auth/AuthContext.tsx");
  const apiClient = readSource("api/client.ts");

  assert.match(layout, /if \(!user\)/);
  assert.match(layout, /<Navigate to="\/login" replace/);
  assert.match(authContext, /api\.getMe\(\)/);
  assert.match(apiClient, /credentials:\s*"include"/);
});

test("프로필 연계 입력은 기준값에 따라 조건부로 노출된다", () => {
  const source = readSource("pages/Profile.tsx");

  assert.match(source, /showMarriageDetails\s*=\s*profile\.marital_status === "MARRIED"/);
  assert.match(source, /showHomelessPeriod\s*=\s*profile\.is_homeless === true/);
  assert.match(source, /showChildDetails\s*=\s*\(profile\.minor_child_count \?\? 0\) > 0/);
  assert.match(source, /\{showMarriageDetails && \(/);
  assert.match(source, /\{showChildDetails && \(/);
  assert.match(source, /next\.marriage_period_years = null/);
});

test("API 오류는 사용자 메시지와 필드별 상세로 변환된다", () => {
  const mapper = readSource("api/errorPresentation.ts");
  const ui = readSource("components/UI.tsx");

  assert.match(mapper, /flattenFieldErrors/);
  assert.match(mapper, /email:\s*"이메일"/);
  assert.match(mapper, /password:\s*"비밀번호"/);
  assert.match(mapper, /title: fieldLabel === "요청"/);
  assert.match(ui, /오류 상세 확인/);
});

test("챗봇은 메시지와 백엔드 session_id를 브라우저 탭 세션에 유지한다", () => {
  const source = readSource("components/ChatbotPanel.tsx");

  assert.match(source, /CHAT_MESSAGES_STORAGE_KEY/);
  assert.match(source, /CHAT_SESSION_STORAGE_KEY/);
  assert.match(source, /sessionStorage\.setItem\(CHAT_MESSAGES_STORAGE_KEY/);
  assert.match(source, /sessionStorage\.setItem\(CHAT_SESSION_STORAGE_KEY/);
  assert.match(source, /session_id: chatSessionId/);
  assert.match(source, /새 대화/);
});

test("모바일 내비게이션과 챗봇 전용 경로가 제공된다", () => {
  const header = readSource("components/SiteHeader.tsx");
  const routes = readSource("routes.tsx");
  const layout = readSource("components/Layout.tsx");

  assert.match(header, /aria-label="모바일 주요 메뉴"/);
  assert.match(header, /lg:hidden/);
  assert.match(header, /\{ path: "\/chatbot", label: "챗봇" \}/);
  assert.match(routes, /\{ path: "\/chatbot", Component: ChatbotPage \}/);
  assert.match(layout, /hidden xl:block/);
});

test("장시간 작업에 중복 요청 방지·로딩·타임아웃 처리가 존재한다", () => {
  const strategy = readSource("pages/StrategyRun.tsx");
  const pdf = readSource("pages/PdfAnalysis.tsx");
  const ui = readSource("components/UI.tsx");

  assert.match(strategy, /if \(isBusy\) return/);
  assert.match(strategy, /new AbortController\(\)/);
  assert.match(strategy, /controller\.abort\(\)/);
  assert.match(strategy, /disabled=\{isBusy/);
  assert.match(strategy, /STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /sessionStorage\.setItem\(STRATEGY_DRAFT_STORAGE_KEY/);
  assert.match(strategy, /api\.analyzePdf\(file\)/);
  assert.match(strategy, /onDrop=\{handlePdfDrop\}/);
  assert.match(pdf, /isUploading/);
  assert.match(pdf, /ProcessingIndicator/);
  assert.match(ui, /animate-spin/);
  assert.match(pdf, /PDF 분석 요청에 실패했습니다/);
});
