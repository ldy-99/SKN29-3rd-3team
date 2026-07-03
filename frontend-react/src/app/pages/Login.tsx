// 역할: 회원가입과 로그인을 처리하는 화면입니다.
// 흐름: 사용자 입력 -> api.signup/api.login -> Django accounts API -> session cookie 발급.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/accounts/views.py.
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/UI";
import { Command } from "lucide-react";
import { api } from "../api/client";

export function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      if (isLogin) {
        await api.login({ email, password });
      } else {
        await api.signup({ email, password });
      }
      navigate("/profile");
    } catch (error) {
      setError(error instanceof Error ? error.message : "인증 요청에 실패했습니다.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-6 font-sans text-[#1d1d1f]">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white rounded-[18px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] mx-auto mb-6 flex items-center justify-center border border-[#e5e5e7]">
            <Command className="w-8 h-8 text-[#007aff]" />
          </div>
          <h1 className="text-[32px] font-bold tracking-tight mb-2">청약 준비를 더 쉽게</h1>
          <p className="text-[15px] text-[#6e6e73]">내 조건을 저장하고 맞춤형 전략을 확인하세요.</p>
        </div>

        <div className="bg-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[#e5e5e7]">
          {/* subtle dev API pill */}
          <div className="flex justify-center mb-6">
            <span className="text-[10px] text-[#6e6e73] font-mono px-2 py-0.5 bg-[#f5f5f7] rounded-full border border-[#e5e5e7]">
              POST {isLogin ? "/api/auth/login" : "/api/auth/signup"}
            </span>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#ff3b30]/10 text-[#ff3b30] text-[13px] rounded-[16px] text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                name="email"
                className="w-full bg-[#f5f5f7] border border-transparent rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] transition-colors"
                placeholder="이메일"
                required
              />
            </div>

            <div>
              <input
                type="password"
                name="password"
                className="w-full bg-[#f5f5f7] border border-transparent rounded-[16px] px-4 py-3.5 text-[15px] focus:outline-none focus:bg-white focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff] transition-colors"
                placeholder="비밀번호"
                required
              />
            </div>

            <Button type="submit" className="w-full mt-2 py-3.5 text-[17px]">
              {isLogin ? "계속하기" : "가입하기"}
            </Button>
          </form>

          <div className="mt-8 text-center text-[13px] text-[#6e6e73]">
            {isLogin ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#007aff] hover:underline"
            >
              {isLogin ? "회원가입" : "로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
