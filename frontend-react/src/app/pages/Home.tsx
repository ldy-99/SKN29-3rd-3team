import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  Landmark,
  LockKeyhole,
  UserRound,
} from "lucide-react";

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
    title: "결과와 다음 행동",
    description: "부족한 정보, 위험 요소와 준비할 항목을 확인합니다.",
  },
];

export function Home() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] font-sans text-[#10284b]">
      <header className="h-[94px] bg-[#fffefa]/95 backdrop-blur-md border-b border-[#e9e4da] sticky top-0 z-30">
        <div className="max-w-[1440px] h-full mx-auto px-6 lg:px-10 flex items-center justify-between gap-8">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <Landmark className="w-8 h-8 text-[#102e5a]" strokeWidth={1.7} />
            <span className="text-[21px] font-bold tracking-[-0.03em]">청약 가이드</span>
          </Link>

          <nav className="hidden md:flex items-center gap-10 text-[15px] font-semibold text-[#26364e]">
            <a href="#service" className="hover:text-[#0b5bd3] transition-colors">서비스 소개</a>
            <a href="#steps" className="hover:text-[#0b5bd3] transition-colors">이용 방법</a>
            <a href="#preview" className="hover:text-[#0b5bd3] transition-colors">진단 예시</a>
            <a href="#assistant" className="hover:text-[#0b5bd3] transition-colors">청약 도우미</a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link to="/login" className="hidden sm:inline-flex px-4 py-3 text-[14px] font-semibold text-[#26364e]">
              로그인
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-[12px] bg-[#102e5a] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#183f75] transition-colors"
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section
          id="service"
          className="relative min-h-[600px] border-b border-[#e9e4da] bg-cover bg-center"
          style={{ backgroundImage: "url('/landing-urban-hero.png')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#fffefa] via-[#fffefa]/95 to-[#fffefa]/5" />
          <div className="relative max-w-[1440px] min-h-[600px] mx-auto px-6 lg:px-10 grid lg:grid-cols-[1.08fr_0.92fr] items-center gap-12 py-16">
            <div className="max-w-[700px]">
              <p className="text-[14px] font-bold tracking-[0.04em] text-[#b86a12] mb-5">
                프로필과 공고를 한 번에 분석
              </p>
              <h1 className="text-[46px] md:text-[58px] xl:text-[66px] font-bold tracking-[-0.045em] leading-[1.18] text-[#102e5a] break-keep">
                복잡한 청약 조건,
                <br />
                내 상황에 맞게 정리하세요
              </h1>
              <p className="mt-7 text-[17px] md:text-[19px] leading-[1.8] text-[#566171] max-w-[620px] break-keep">
                청약 프로필과 관심 모집공고를 바탕으로 자격, 가점, 위험 요소와 준비 전략을 확인합니다.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 rounded-[13px] bg-[#102e5a] px-7 py-4 text-[16px] font-bold text-white hover:bg-[#183f75] transition-colors"
                >
                  내 조건 진단하기
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#steps"
                  className="inline-flex items-center justify-center gap-2 rounded-[13px] border border-[#b9b7b1] bg-[#fffefa]/80 px-7 py-4 text-[16px] font-bold text-[#26364e] hover:bg-white transition-colors"
                >
                  이용 방법 보기
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div id="preview" className="hidden lg:block">
              <div className="max-w-[390px] ml-auto rounded-[22px] border border-[#ded8cc] bg-[#fffefa]/95 p-7 shadow-[0_22px_60px_rgba(24,40,65,0.16)] backdrop-blur-md">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-[22px] font-bold text-[#152846]">내 진단 결과 미리보기</h2>
                  <span className="w-9 h-9 rounded-full bg-[#f7eedf] flex items-center justify-center text-[#b86a12]">
                    <ClipboardList className="w-5 h-5" />
                  </span>
                </div>
                <PreviewRow label="충족 조건" />
                <PreviewRow label="확인 필요 정보" />
                <PreviewRow label="검토할 공급 유형" />
                <PreviewRow label="다음 준비 행동" last />
              </div>
            </div>
          </div>
        </section>

        <section id="steps" className="py-16 md:py-20 bg-[#fffefa]">
          <div className="max-w-[1360px] mx-auto px-6 lg:px-10">
            <div className="text-center mb-10">
              <p className="text-[13px] font-bold tracking-[0.08em] text-[#b86a12] mb-3">HOW IT WORKS</p>
              <h2 className="text-[30px] md:text-[38px] font-bold tracking-[-0.035em] text-[#102e5a]">
                청약 준비를 세 단계로 정리합니다
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {serviceSteps.map((step) => (
                <article key={step.title} className="rounded-[20px] border border-[#e5dfd4] bg-white p-7 shadow-[0_10px_30px_rgba(35,45,60,0.04)]">
                  <div className="w-14 h-14 rounded-full bg-[#f7f1e8] flex items-center justify-center text-[#102e5a] mb-5">
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

function PreviewRow({ label, last = false }: { label: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 py-4 ${last ? "" : "border-b border-[#e9e4da]"}`}>
      <CheckCircle2 className="w-5 h-5 text-[#102e5a]" />
      <span className="flex-1 text-[15px] font-semibold text-[#26364e]">{label}</span>
      <ArrowRight className="w-4 h-4 text-[#a36a25]" />
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
