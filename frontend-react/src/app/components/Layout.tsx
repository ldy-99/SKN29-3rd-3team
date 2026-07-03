import { NavLink, Outlet, useLocation } from "react-router";
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
];

export function Layout() {
  const location = useLocation();

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
                  flex items-center gap-3.5 px-4 py-3.5 rounded-[14px] font-semibold text-[15px] transition-colors
                  ${isActive 
                    ? "bg-[#edf2f8] text-[#0b4ea2]"
                    : "text-[#455268] hover:bg-[#f5f2eb] hover:text-[#102e5a]"}
                `}
              >
                {item.icon}
                {item.label}
              </NavLink>
            );
          })}

          <div className="flex items-center gap-3.5 px-4 py-3.5 text-[14px] font-medium text-[#9aa1aa]">
            <FileText className="w-5 h-5" />
            <span>PDF 분석 · 준비 중</span>
          </div>
        </nav>

        <div className="p-3.5 mb-3">
          <div className="bg-white rounded-[18px] border border-[#e5dfd4] overflow-hidden shadow-[0_8px_24px_rgba(35,45,60,0.04)]">
            <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#f1eee7] flex items-center justify-center text-[#526070] font-semibold text-[13px]">
              홍
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">홍길동</p>
              <p className="text-[12px] text-[#7d8490] truncate">user@example.com</p>
            </div>
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
