import { NavLink, Outlet, useLocation } from "react-router";
import { 
  User, 
  CheckSquare, 
  FileText, 
  LogOut,
  Command,
  LayoutDashboard
} from "lucide-react";
import { ChatbotPanel } from "./ChatbotPanel";
import { api } from "../api/client";

const navItems = [
  { path: "/", label: "대시보드", icon: <LayoutDashboard className="w-5 h-5" />, exact: true },
  { path: "/profile", label: "프로필", icon: <User className="w-5 h-5" /> },
  { path: "/strategy", label: "전략 진단", icon: <CheckSquare className="w-5 h-5" /> },
  { path: "/pdf", label: "PDF 분석", icon: <FileText className="w-5 h-5" /> },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex font-sans text-[#1d1d1f]">
      {/* Slim Sidebar (Top Nav in desktop can also work, but let's do a very clean left sidebar) */}
      <aside className="w-[240px] bg-[#f5f5f7] border-r border-[#e5e5e7] flex-col hidden lg:flex sticky top-0 h-screen shrink-0">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#007aff] rounded-[12px] flex items-center justify-center text-white shadow-sm">
            <Command className="w-5 h-5" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight">청약 준비</span>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4">
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
              홍
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold truncate">홍길동</p>
              <p className="text-[12px] text-[#6e6e73] truncate">user@apple.com</p>
            </div>
          </div>
          <NavLink
            to="/login"
            onClick={() => void api.logout()}
            className="flex items-center gap-3 px-4 py-3 rounded-[14px] text-[15px] font-medium text-[#6e6e73] hover:bg-[#e5e5e7]/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </NavLink>
        </div>
      </aside>

      {/* Main Content Area (2/3 roughly) */}
      <main className="flex-1 w-full max-w-[1440px] flex flex-col min-h-screen relative overflow-y-auto">
        <div className="flex-1 p-6 md:p-10 xl:p-12 w-full mx-auto">
          <div className="max-w-[760px] w-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Right Chatbot Panel (1/3) */}
      <aside className="w-[460px] 2xl:w-[500px] shrink-0 border-l border-[#e5e5e7] bg-white/60 backdrop-blur-2xl hidden md:block sticky top-0 h-screen">
        <div className="p-6 h-full">
          <ChatbotPanel />
        </div>
      </aside>
    </div>
  );
}
