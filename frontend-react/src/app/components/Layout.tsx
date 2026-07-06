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

      <div className="min-h-[calc(100vh-94px)] flex">
        <main className="flex-1 min-w-0">
          <div className="w-full px-6 py-9 md:px-10 xl:px-12 xl:py-12">
            <div className="max-w-[860px] w-full mx-auto">
              <Outlet />
            </div>
          </div>
        </main>

        {location.pathname !== "/chatbot" && (
          <aside className="w-[460px] 2xl:w-[520px] shrink-0 border-l border-[#e9e4da] bg-white hidden xl:block sticky top-[94px] h-[calc(100vh-94px)]">
            <div className="p-4 2xl:p-5 h-full">
              <ChatbotPanel />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
