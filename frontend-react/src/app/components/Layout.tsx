// 역할: 화면 공통 네비게이션과 페이지 틀을 제공합니다.
// 흐름: App.tsx -> Layout.tsx -> 현재 route page + ChatbotPanel.
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  User,
  CheckSquare,
  FileText,
  LogOut,
  House,
  History,
  Landmark
} from "lucide-react";
import { ChatbotPanel } from "./ChatbotPanel";
import { api } from "../api/client";

const navItems = [
  { path: "/", label: "홈", icon: <House className="w-5 h-5" />, exact: true },
  { path: "/profile", label: "내 청약 조건", icon: <User className="w-5 h-5" /> },
  { path: "/strategy", label: "전략 진단", icon: <CheckSquare className="w-5 h-5" /> },
  { path: "/results", label: "진단 기록", icon: <History className="w-5 h-5" /> },
  { path: "/pdf", label: "PDF 분석", icon: <FileText className="w-5 h-5" /> },
];

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ username: string; email: string } | null>(null);

  useEffect(() => {
    api.getMe()
      .then((user) => setCurrentUser(user))
      .catch((err) => {
        console.error("Not authenticated", err);
        navigate("/login");
      });
  }, [navigate]);

  const initial = currentUser?.username ? currentUser.username.charAt(0).toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-[#fbfaf7] flex font-sans text-[#10284b]">
      <aside className="w-[240px] bg-[#fffefa] border-r border-[#e9e4da] flex-col hidden lg:flex sticky top-0 h-screen shrink-0">
        <div className="h-[94px] px-7 flex items-center gap-3 border-b border-[#eee9df]">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center text-[#102e5a]">
            <Landmark className="w-7 h-7" strokeWidth={1.8} />
          </div>
          <span className="font-bold text-[19px] tracking-[-0.02em]">청약 가이드</span>
        </div>

        <nav className="flex-1 px-3.5 space-y-2 mt-7">
          {navItems.map((item) => {
            const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-[14px] font-medium text-[15px] transition-colors
                  ${isActive
                    ? "bg-[#e5e5e7]/50 text-[#1d1d1f]"
                    : "text-[#6e6e73] hover:bg-[#e5e5e7]/30 hover:text-[#1d1d1f]"}
                `}
              >
                {item.icon}
                {item.label}
              </NavLink>
            );
          })}

        </nav>

        <div className="p-4 mb-4">
          <div className="px-4 py-3 bg-white rounded-[16px] shadow-sm border border-[#e5e5e7] mb-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] font-semibold text-[13px]">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">{currentUser?.username ?? "로딩 중..."}</p>
              <p className="text-[12px] text-[#6e6e73] truncate">{currentUser?.email ?? ""}</p>
            </div>
            <NavLink
              to="/login"
              onClick={() => void api.logout()}
              className="flex items-center gap-3 px-4 py-3.5 border-t border-[#eee9df] text-[14px] font-medium text-[#596273] hover:bg-[#faf8f3] transition-colors"
            >
              <LogOut className="w-5 h-5" />
              로그아웃
            </NavLink>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col min-h-screen relative overflow-y-auto bg-[#fbfaf7]">
        <div className="flex-1 px-6 py-9 md:px-10 xl:px-12 xl:py-12 w-full">
          <div className="max-w-[760px] w-full mx-auto">
            <Outlet />
          </div>
        </div>
      </main>

      <aside className="w-[420px] 2xl:w-[460px] shrink-0 border-l border-[#e9e4da] bg-[#fffefa] hidden md:block sticky top-0 h-screen">
        <div className="p-5 h-full">
          <ChatbotPanel />
        </div>
      </aside>
    </div>
  );
}
