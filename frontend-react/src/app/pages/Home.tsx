import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { useAuth } from "../auth/AuthContext";

const serviceSteps = [
  {
    icon: <UserRound className="w-7 h-7" />,
    title: "내 조건 정리",
    description: "청약통장, 거주, 무주택과 세대 정보를 저장합니다.",
  },
  {
    icon: <FileSearch className="w-7 h-7" />,
    title: "공고 조건 비교",
    description: "관심 모집공고와 내 프로필 조건을 함께 분석합니다.",
  },
  {
    icon: <ClipboardList className="w-7 h-7" />,
    title: "청약 진단",
    description: "위험 요소와 청약 전략을 확인합니다.",
  },
];

export function Home() {
  const { user, isLoading } = useAuth();
  const diagnosisPath = isLoading ? "/" : user ? "/strategy" : "/login";
  const historyPath = isLoading ? "/" : user ? "/mypage" : "/login";

  return (
    <div className="min-h-screen bg-[#fbfaf7] font-sans text-[#10284b]">
      <SiteHeader />

      <main>
        <section
          id="service"
          className="landing-hero-pan relative min-h-[520px] md:min-h-[600px] border-b border-[#e9e4da] bg-no-repeat bg-[length:auto_100%] bg-[position:68%_center] md:bg-cover"
          style={{ backgroundImage: "url('/landing-urban-hero.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#fffefa] via-[#fffefa]/95 to-[#fffefa]/5" />
          <div className="relative max-w-[1440px] min-h-[520px] md:min-h-[600px] mx-auto px-6 lg:px-10 flex items-center py-12 md:py-16">
            <div className="landing-reveal max-w-[760px]">
              <h1 className="text-[46px] md:text-[58px] xl:text-[66px] font-bold tracking-[-0.045em] leading-[1.18] text-[#102e5a] break-keep">
                아파트 분양 청약 조건을
                <br />
                내 상황에 맞게 진단해 보세요
              </h1>
              <p className="mt-7 text-[17px] md:text-[19px] leading-[1.8] text-[#566171] max-w-[620px] break-keep">
                청약 프로필과 아파트 입주자모집공고를 바탕으로 자격, 가점, 위험 요소와 준비 전략을 확인합니다.
              </p>
              <div className="mt-5 max-w-[620px] rounded-[14px] border border-[#e4d8c5] bg-[#fffaf1]/90 px-4 py-3 text-[14px] leading-relaxed text-[#6f5737]">
                현재 데모 버전은 아파트 분양 청약만 지원합니다. 오피스텔·임대주택·토지·상가 청약은 추후 지원 예정입니다.
              </div>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  to={diagnosisPath}
                  aria-disabled={isLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-[13px] bg-[#102e5a] px-7 py-4 text-[16px] font-bold text-white hover:bg-[#183f75] transition-colors ${
                    isLoading ? "pointer-events-none opacity-70" : ""
                  }`}
                >
                  {isLoading ? "로그인 상태 확인 중" : user ? "전략 진단 계속하기" : "내 조건 진단하기"}
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  to={historyPath}
                  state={!isLoading && !user ? { from: "/mypage" } : undefined}
                  aria-disabled={isLoading}
                  className={`inline-flex items-center justify-center gap-2 rounded-[13px] border border-[#b9b7b1] bg-[#fffefa]/80 px-7 py-4 text-[16px] font-bold text-[#26364e] hover:bg-white transition-colors ${
                    isLoading ? "pointer-events-none opacity-70" : ""
                  }`}
                >
                  진단 기록 보기
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>

          </div>
        </section>

        <section id="steps" className="py-16 md:py-20 bg-[#fffefa]">
          <div className="max-w-[1360px] mx-auto px-6 lg:px-10">
            <div className="landing-reveal text-center mb-10">
              <p className="text-[13px] font-bold tracking-[0.08em] text-[#b86a12] mb-3">HOW IT WORKS</p>
              <h2 className="text-[30px] md:text-[38px] font-bold tracking-[-0.035em] text-[#102e5a]">
                청약 준비를 세 단계로 정리합니다
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {serviceSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="landing-step-card rounded-[20px] border border-[#e5dfd4] bg-white p-7 shadow-[0_10px_30px_rgba(35,45,60,0.04)]"
                  style={{ animationDelay: `${index * 130}ms` }}
                >
                  <div className="landing-float w-14 h-14 rounded-full bg-[#f7f1e8] flex items-center justify-center text-[#102e5a] mb-5" style={{ animationDelay: `${index * 220}ms` }}>
                    {step.icon}
                  </div>
                  <h3 className="text-[20px] font-bold text-[#152846]">{step.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#68717d]">{step.description}</p>
                </article>
              ))}
            </div>

            <div id="assistant" className="mt-8 rounded-[18px] border border-[#e5dfd4] bg-[#fbfaf7] px-6 py-5 grid md:grid-cols-3 gap-5">
              <TrustItem icon={<CheckCircle2 className="w-5 h-5" />} text="공식 청약 자료 기반" />
              <TrustItem icon={<LockKeyhole className="w-5 h-5" />} text="사용자별 프로필·결과 관리" />
              <TrustItem icon={<Bot className="w-5 h-5" />} text="답변 근거와 출처 제공" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function TrustItem({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-3 text-[14px] font-semibold text-[#3d4a5d]">
      <span className="text-[#102e5a]">{icon}</span>
      {text}
    </div>
  );
}
