import { ArrowRight, LogOut } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { BrandMark } from "./BrandMark";

const tabs = [
  { path: "/", label: "홈", end: true },
  { path: "/profile", label: "내 청약 조건" },
  { path: "/strategy", label: "전략 진단" },
  { path: "/mypage", label: "진단 기록" },
  { path: "/chatbot", label: "챗봇" },
];

export function SiteHeader() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-30">
      <div className="max-w-[1440px] h-[72px] lg:h-[94px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-4 lg:gap-6 xl:gap-10">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <BrandMark />
        </Link>

        <nav className="hidden lg:flex h-full items-center gap-1 xl:gap-2 flex-1" aria-label="주요 메뉴">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.end}
              className={({ isActive }) =>
                `h-full px-4 xl:px-5 flex items-center border-b-2 text-[14px] xl:text-[15px] font-semibold transition-colors ${
                  isActive
                    ? "border-[#102e5a] text-[#102e5a]"
                    : "border-transparent text-[#596273] hover:text-[#102e5a]"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {isLoading ? (
            <div className="h-10 w-28 rounded-[11px] bg-[#f1ede5] animate-pulse" aria-label="로그인 상태 확인 중" />
          ) : user ? (
            <>
              <Link
                to="/mypage"
                className="hidden sm:flex items-center gap-2 px-3 py-2 text-[14px] font-semibold text-[#26364e]"
              >
                <span className="w-8 h-8 rounded-full bg-[#f3ede3] flex items-center justify-center text-[#102e5a]">
                  {user.username.charAt(0).toUpperCase()}
                </span>
                <span className="max-w-[110px] truncate">{user.username}</span>
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-2 rounded-[11px] border border-[#d9d3c8] px-4 py-2.5 text-[13px] font-semibold text-[#596273] hover:bg-[#f7f3ec]"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-[12px] bg-[#102e5a] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#183f75]"
            >
              로그인 · 회원가입
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      <nav className="lg:hidden h-[52px] border-t border-[#eef0f3] flex overflow-x-auto px-2" aria-label="모바일 주요 메뉴">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.end}
            className={({ isActive }) =>
              `min-w-[72px] flex-1 px-3 flex items-center justify-center border-b-2 whitespace-nowrap text-[13px] font-semibold transition-colors ${
                isActive
                  ? "border-[#102e5a] text-[#102e5a]"
                  : "border-transparent text-[#68717d]"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
