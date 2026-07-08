// 역할: 로그인 후 사용하는 보호 화면 레이아웃과 플로팅 챗봇 진입점을 감쌉니다.
// 흐름: routes.tsx -> Layout -> AuthContext -> Profile/Strategy/MyPage/Result/Pdf/Chatbot.
// 다음 파일: frontend-react/src/app/auth/AuthContext.tsx, frontend-react/src/app/components/SiteHeader.tsx.
import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Navigate, Outlet, useLocation } from "react-router";
import { ChatbotPanel } from "./ChatbotPanel";
import { SiteHeader } from "./SiteHeader";
import { useAuth } from "../auth/AuthContext";

export function Layout() {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fbfaf7] font-sans text-[#10284b]">
        <SiteHeader />
        <div className="min-h-[calc(100vh-94px)] flex items-center justify-center text-[14px] text-[#68717d]">
          로그인 상태를 확인하고 있습니다.
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-screen bg-[#fbfaf7] font-sans text-[#10284b]">
      <SiteHeader />

      <main className="min-h-[calc(100vh-94px)] min-w-0">
        <div
          className={`w-full ${
            location.pathname === "/chatbot"
              ? "px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8"
              : "px-6 py-9 md:px-10 xl:px-12 xl:py-12"
          }`}
        >
          <div
            className={`w-full mx-auto ${
              location.pathname === "/chatbot" ? "max-w-[1100px]" : "max-w-[1040px]"
            }`}
          >
            <Outlet />
          </div>
        </div>
      </main>

      {location.pathname !== "/chatbot" && <FloatingChatbot />}
    </div>
  );
}

function FloatingChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = "floating-chatbot-panel";

  return (
    <div className="no-print fixed bottom-5 right-5 z-40 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div
          id={panelId}
          className="relative mb-3 h-[min(720px,calc(100vh-128px))] w-[calc(100vw-40px)] max-w-[430px] overflow-hidden rounded-[24px] bg-white shadow-[0_24px_80px_rgba(16,46,90,0.24)]"
          role="dialog"
          aria-label="청약 상담 챗봇"
        >
          <ChatbotPanel />
        </div>
      )}

      <button
        type="button"
        className="ml-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#102e5a] text-white shadow-[0_18px_42px_rgba(16,46,90,0.26)] transition-all hover:-translate-y-0.5 hover:bg-[#183f75] focus:outline-none focus:ring-4 focus:ring-[#245ea8]/20"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        aria-label={isOpen ? "챗봇 접기" : "챗봇 열기"}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
