import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { ErrorNotice } from "../components/UI";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { BrandMark } from "../components/BrandMark";

type AuthMode = "login" | "signup";

export function Login() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthenticatedUser } = useAuth();
  const isLogin = mode === "login";

  const passwordChecks = useMemo(() => {
    const emailPrefix = email.split("@")[0]?.trim().toLowerCase() ?? "";
    const normalizedPassword = password.toLowerCase();

    return {
      minimumLength: password.length >= 8,
      notNumericOnly: password.length > 0 && !/^\d+$/.test(password),
      confirmed: password.length > 0 && password === passwordConfirm,
      notSimilarToEmail:
        password.length > 0 &&
        (emailPrefix.length < 3 || !normalizedPassword.includes(emailPrefix)),
      notCommon:
        password.length > 0 &&
        !/(password|qwerty|asdf|1234|1111|0000)/i.test(password),
    };
  }, [email, password, passwordConfirm]);
  const arePasswordRulesComplete = Object.values(passwordChecks).every(Boolean);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setPasswordConfirm("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);

    if (!isLogin) {
      if (!passwordChecks.minimumLength) {
        setError("비밀번호는 8자 이상이어야 합니다.");
        return;
      }
      if (!passwordChecks.notNumericOnly) {
        setError("비밀번호는 숫자로만 구성할 수 없습니다.");
        return;
      }
      if (!passwordChecks.confirmed) {
        setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        return;
      }
      if (!passwordChecks.notSimilarToEmail) {
        setError("비밀번호에 이메일 아이디를 그대로 포함할 수 없습니다.");
        return;
      }
      if (!passwordChecks.notCommon) {
        setError("연속된 숫자나 password, qwerty처럼 쉽게 추측되는 비밀번호는 사용할 수 없습니다.");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const user = isLogin
        ? await api.login({ email, password })
        : await api.signup({ email, password });
      setAuthenticatedUser(user);
      const destination =
        typeof location.state?.from === "string" ? location.state.from : "/profile";
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfaf7] px-5 py-8 font-sans text-[#152846]">
      <div className="mx-auto w-full max-w-[480px]">
        <Link to="/" className="mb-9 flex items-center justify-center gap-3">
          <BrandMark />
        </Link>

        <div className="overflow-hidden rounded-[24px] border border-[#ded8cc] bg-white shadow-[0_18px_55px_rgba(24,40,65,0.09)]">
          <div className="grid grid-cols-2 border-b border-[#e9e4da] bg-[#f7f3ec] p-1.5">
            <ModeTab active={isLogin} onClick={() => changeMode("login")}>
              로그인
            </ModeTab>
            <ModeTab active={!isLogin} onClick={() => changeMode("signup")}>
              회원가입
            </ModeTab>
          </div>

          <div className="p-7 sm:p-9">
            <div className="mb-7">
              <p className="mb-2 text-[13px] font-bold tracking-[0.04em] text-[#b86a12]">
                {isLogin ? "MEMBER LOGIN" : "CREATE ACCOUNT"}
              </p>
              <h1 className="text-[28px] font-bold tracking-[-0.035em] text-[#102e5a]">
                {isLogin ? "저장한 진단을 이어보세요" : "청약 진단을 시작하세요"}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[#68717d]">
                {isLogin
                  ? "가입한 이메일과 비밀번호로 로그인합니다."
                  : "계정을 만들면 프로필과 전략 진단 결과를 다시 확인할 수 있습니다."}
              </p>
            </div>

            <ErrorNotice error={error} fallbackMessage="인증 요청을 처리하지 못했습니다." />

            <form onSubmit={handleSubmit} className="space-y-5">
              <AuthField label="이메일">
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputClass}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                />
              </AuthField>

              <AuthField label="비밀번호">
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                  placeholder={isLogin ? "비밀번호 입력" : "8자 이상 입력"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
              </AuthField>

              {!isLogin && (
                <>
                  <AuthField label="비밀번호 확인">
                    <input
                      type="password"
                      name="passwordConfirm"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      className={inputClass}
                      placeholder="비밀번호 다시 입력"
                      autoComplete="new-password"
                      required
                    />
                  </AuthField>

                  <div
                    className={`rounded-[16px] border p-4 transition-colors ${
                      arePasswordRulesComplete
                        ? "border-[#9bd4ac] bg-[#f0fbf3]"
                        : "border-[#e5dfd4] bg-[#fbfaf7]"
                    }`}
                  >
                    <p className={`mb-3 text-[13px] font-bold ${arePasswordRulesComplete ? "text-[#16823b]" : "text-[#26364e]"}`}>
                      {arePasswordRulesComplete ? "비밀번호 생성 규칙을 모두 충족했습니다" : "비밀번호 생성 규칙"}
                    </p>
                    <ul className="space-y-2">
                      <PasswordRule checked={passwordChecks.minimumLength}>
                        8자 이상 입력
                      </PasswordRule>
                      <PasswordRule checked={passwordChecks.notNumericOnly}>
                        숫자로만 구성하지 않기
                      </PasswordRule>
                      <PasswordRule checked={passwordChecks.confirmed}>
                        비밀번호 확인과 일치
                      </PasswordRule>
                      <PasswordRule checked={passwordChecks.notSimilarToEmail}>
                        이메일 앞부분을 그대로 넣지 마세요. 예: minsu@example.com → minsu1234
                      </PasswordRule>
                      <PasswordRule checked={passwordChecks.notCommon}>
                        password1234, qwerty1234처럼 쉽게 추측되는 비밀번호는 사용할 수 없습니다.
                      </PasswordRule>
                    </ul>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 inline-flex w-full items-center justify-center rounded-[13px] bg-[#102e5a] px-6 py-4 text-[16px] font-bold text-white transition-colors hover:bg-[#183f75] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? isLogin
                    ? "로그인 중..."
                    : "가입 처리 중..."
                  : isLogin
                    ? "로그인"
                    : "회원가입"}
              </button>
            </form>

            <p className="mt-7 text-center text-[13px] text-[#68717d]">
              {isLogin ? "처음 이용하시나요?" : "이미 계정이 있나요?"}{" "}
              <button
                type="button"
                onClick={() => changeMode(isLogin ? "signup" : "login")}
                className="font-bold text-[#0b5bd3] hover:underline"
              >
                {isLogin ? "회원가입으로 이동" : "로그인으로 이동"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[13px] border border-[#dcd7ce] bg-white px-4 py-3.5 text-[15px] text-[#152846] outline-none transition focus:border-[#0b5bd3] focus:ring-2 focus:ring-[#0b5bd3]/10";

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[12px] px-4 py-3 text-[14px] font-bold transition ${
        active
          ? "bg-white text-[#102e5a] shadow-sm"
          : "text-[#727987] hover:text-[#102e5a]"
      }`}
    >
      {children}
    </button>
  );
}

function AuthField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold text-[#3d4a5d]">{label}</span>
      {children}
    </label>
  );
}

function PasswordRule({
  checked,
  children,
}: {
  checked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex items-start gap-2 text-[12px] ${checked ? "text-[#208444]" : "text-[#727987]"}`}>
      {checked ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Circle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}
