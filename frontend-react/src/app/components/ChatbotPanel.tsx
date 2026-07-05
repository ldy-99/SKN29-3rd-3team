// 역할: 어느 화면에서든 RAG 챗봇 질문을 보낼 수 있는 패널입니다.
// 흐름: ChatbotPanel -> api.askChatbot -> Django ChatbotAPIView -> FastAPI /api/chat -> RAG graph.
// 다음 파일: frontend-react/src/app/api/client.ts, django_backend/strategy/views.py.
import { useState, useRef, useEffect } from "react";
import { Bot, ArrowUp, BookOpen, ChevronDown, Sparkles, AlertCircle } from "lucide-react";
import { useLocation } from "react-router";
import { api } from "../api/client";

type Message = {
  id: number;
  type: "user" | "bot";
  content: string;
  sources?: string[];
  variant?: "greeting" | "answer" | "error";
};

export function ChatbotPanel() {
  const location = useLocation();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const getContextMessage = () => {
    if (location.pathname.includes("/profile")) return "프로필 입력에 필요한 청약 기준을 물어보세요.";
    if (location.pathname.includes("/strategy")) return "지원 자격과 공급 유형별 기준을 물어보세요.";
    if (location.pathname.includes("/pdf")) return "공고문에 나오는 청약 용어와 기준을 물어보세요.";
    if (location.pathname.includes("/results")) return "진단 결과에 나온 청약 제도와 기준을 물어보세요.";
    if (location.pathname.includes("/mypage")) return "진단 기록을 검토할 때 필요한 청약 기준을 물어보세요.";
    return "주택청약 제도와 자격 조건을 물어보세요.";
  };

  const getRecommendedQuestions = () => {
    if (location.pathname.includes("/profile")) {
      return [
        "무주택 기간은 어떤 기준으로 계산하나요?",
        "부양가족 수에 포함되는 가족 범위는 무엇인가요?",
      ];
    }
    if (location.pathname.includes("/strategy")) {
      return [
        "민영주택 일반공급 1순위 조건은 무엇인가요?",
        "신혼부부 특별공급의 기본 자격은 무엇인가요?",
      ];
    }
    if (location.pathname.includes("/pdf")) {
      return [
        "입주자모집공고에서 꼭 확인할 항목은 무엇인가요?",
        "공고문의 소득 기준은 어떻게 확인하나요?",
      ];
    }
    if (location.pathname.includes("/results")) {
      return [
        "청약 가점은 어떤 항목으로 계산하나요?",
        "특별공급 유형별 기본 자격 차이를 알려주세요.",
      ];
    }
    if (location.pathname.includes("/mypage")) {
      return [
        "청약통장 가입기간은 언제부터 계산하나요?",
        "재당첨 제한은 어떤 경우에 적용되나요?",
      ];
    }
    return ["청약 1순위 조건이 무엇인가요?", "생애최초 특별공급이란?"];
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "안녕하세요. 청약 도우미입니다. " + getContextMessage(),
      variant: "greeting",
    }
  ]);

  // Update greeting when location changes significantly
  useEffect(() => {
    if (messages.length <= 2) {
      setMessages([{
        id: Date.now(),
        type: "bot",
        content: "안녕하세요. 청약 도우미입니다. " + getContextMessage(),
        variant: "greeting",
      }]);
    }
  }, [location.pathname]);

  const updateMessageScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.type === "bot" && latestMessage.variant === "answer") {
      const target = container.querySelector<HTMLElement>(`[data-message-id="${latestMessage.id}"]`);
      if (target) {
        container.scrollTo({
          top: Math.max(target.offsetTop - container.offsetTop - 16, 0),
          behavior: "smooth",
        });
        return;
      }
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    updateMessageScroll();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    const question = text.trim();
    if (!question || isTyping) return;

    const newMsg: Message = { id: Date.now(), type: "user", content: question };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.askChatbot({ question, session_id: chatSessionId });
      setChatSessionId(response.session_id);
      setIsTyping(false);
      const botResponse: Message = {
        id: Date.now() + 1,
        type: "bot",
        content: response.answer,
        sources: response.sources,
        variant: "answer",
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: "bot",
        content: error instanceof Error ? error.message : "챗봇 요청에 실패했습니다.",
        variant: "error",
      }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#fffefa] border border-[#e5dfd4] rounded-[22px] shadow-[0_12px_34px_rgba(35,45,60,0.05)] overflow-hidden relative">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#eee9df] bg-[#fffefa]/95 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f3eee4] flex items-center justify-center text-[#102e5a]">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-[17px] text-[#152846]">청약 도우미</h3>
            <p className="text-[12px] text-[#747c87] flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#34c759]"></span>
              청약 제도 자료 검색 가능
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-5 space-y-4 bg-[#fbfaf7]"
      >
        <div className="text-center">
          <p className="text-[11px] text-[#7b828d] bg-[#f3f0e9] inline-block px-3 py-1 rounded-full">
            이 대화는 DB에 저장되지 않으며 새로고침 시 사라집니다.
          </p>
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            data-message-id={msg.id}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} w-full`}
          >
            <div className={`${msg.type === 'user' ? 'max-w-[82%]' : 'w-full'}`}>
              <div className={`text-[15px] ${
                msg.type === 'user'
                  ? 'bg-[#007aff] text-white rounded-[18px] rounded-br-md px-4 py-3 leading-relaxed'
                  : msg.variant === "greeting"
                    ? 'bg-[#fffaf1] text-[#26364e] rounded-[16px] border border-[#eadfca] px-4 py-4'
                    : msg.variant === "error"
                      ? 'bg-[#fff2f1] text-[#1d1d1f] rounded-[16px] border border-[#ffd4d0] px-4 py-4'
                      : 'bg-white text-[#26364e] rounded-[20px] border border-[#ddd7cb] shadow-[0_4px_18px_rgba(35,45,60,0.03)] px-5 py-5'
              }`}>
                {msg.type === "bot" ? (
                  <BotMessageContent
                    content={msg.content}
                    sources={msg.sources}
                    variant={msg.variant}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          </div>
        ))}

        {messages.length < 5 && (
          <div className="grid gap-2 pt-1">
            {getRecommendedQuestions().map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={isTyping}
                className="group flex items-center justify-between gap-3 text-[13px] px-4 py-3.5 rounded-[14px] border border-[#d9e0e9] text-[#0b5bd3] bg-white hover:bg-[#f4f7fb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
              >
                <span>{q}</span>
                <span aria-hidden="true" className="text-[18px] leading-none transition-transform group-hover:translate-x-0.5">›</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void handleSend(input);
              }
            }}
            placeholder="청약 도우미에게 질문하세요"
            className="w-full bg-white border border-[#d8d2c7] rounded-[16px] pl-4 pr-12 py-3.5 text-[14px] text-[#26364e] placeholder:text-[#8e939b] focus:outline-none focus:ring-2 focus:ring-[#245ea8]/15 focus:border-[#245ea8] transition-colors"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="absolute right-1.5 w-9 h-9 bg-[#102e5a] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:bg-[#8e8e93] transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BotMessageContent({
  content,
  sources,
  variant = "answer",
}: {
  content: string;
  sources?: string[];
  variant?: Message["variant"];
}) {
  const [showSources, setShowSources] = useState(false);

  if (variant === "greeting") {
    return (
      <div className="flex gap-2.5 leading-[1.65]">
        <Sparkles className="w-4 h-4 text-[#b86a12] mt-1 shrink-0" />
        <p>{content}</p>
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="flex gap-2.5 leading-[1.65]">
        <AlertCircle className="w-4 h-4 text-[#ff3b30] mt-1 shrink-0" />
        <div>
          <p className="font-semibold text-[14px]">답변을 불러오지 못했습니다</p>
          <p className="mt-1 text-[13px] text-[#6e6e73]">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-[#0b5bd3]">
        <Bot className="w-4 h-4" />
        <span className="text-[12px] font-semibold">청약 도우미 답변</span>
      </div>

      <StructuredAnswer content={content} />

      {!!sources?.length && (
        <div className="mt-5 pt-4 border-t border-[#eee9df]">
          <button
            type="button"
            onClick={() => setShowSources((current) => !current)}
            aria-expanded={showSources}
            className="w-full flex items-center gap-2 rounded-[12px] bg-[#f5f3ee] px-3 py-2.5 text-[13px] font-medium text-[#68717d] hover:bg-[#eeebe4] transition-colors"
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>참고 출처 {sources.length}개 보기</span>
            <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showSources ? "rotate-180" : ""}`} />
          </button>

          {showSources && (
            <ul className="mt-2 space-y-1.5 px-1">
              {sources.map((source, index) => (
                <li key={`${source}-${index}`} className="text-[12px] leading-relaxed text-[#6e6e73]">
                  {source}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredAnswer({ content }: { content: string }) {
  const normalized = content
    .replace(/\s+(#{1,4}\s+)/g, "\n\n$1")
    .replace(/\s+(-\s+)/g, "\n$1")
    .trim();
  const blocks = normalized.split(/\n\s*\n/).filter(Boolean);

  return (
    <div className="space-y-4 leading-[1.75] break-words">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\r?\n/).filter((line) => line.trim());
        const sectionLabel = getSectionLabel(block, blockIndex);

        return (
          <section
            key={`${block.slice(0, 20)}-${blockIndex}`}
            className={blockIndex === 0 ? "" : "pt-4 border-t border-[#ececf0]"}
          >
            {sectionLabel && (
              <p className="mb-2 text-[12px] font-semibold tracking-[-0.01em] text-[#007aff]">
                {sectionLabel}
              </p>
            )}
            <div className="space-y-2.5">
              {lines.map((line, lineIndex) => renderLine(line, `${blockIndex}-${lineIndex}`))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function renderLine(line: string, key: string) {
        const trimmed = line.trim();

        const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
        if (heading) {
          const numberedHeading = heading[1].match(/^(\d+)[.)]\s+(.+)$/);
          if (numberedHeading) {
            return (
              <div key={key} className="flex items-center gap-3 pt-1">
                <span className="w-7 h-7 rounded-[8px] bg-[#007aff] text-white text-[13px] font-semibold flex items-center justify-center shrink-0">
                  {numberedHeading[1]}
                </span>
                <h4 className="text-[16px] font-bold leading-snug text-[#1d1d1f]">
                  <InlineText text={numberedHeading[2]} />
                </h4>
              </div>
            );
          }

          return (
            <h4 key={key} className="pt-1 text-[17px] font-bold leading-snug text-[#1d1d1f]">
              <InlineText text={heading[1]} />
            </h4>
          );
        }

        const listItem = trimmed.match(/^[-*]\s+(.+)$/);
        if (listItem) {
          return (
            <div key={key} className="flex gap-2 pl-1">
              <span className="mt-[0.65em] w-1.5 h-1.5 rounded-full bg-[#007aff] shrink-0" />
              <p><InlineText text={listItem[1]} /></p>
            </div>
          );
        }

        const numberedItem = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
        if (numberedItem) {
          return (
            <div key={key} className="flex gap-3 pt-1">
              <span className="w-6 h-6 rounded-[8px] bg-[#007aff] text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
                {numberedItem[1]}
              </span>
              <p className="font-medium"><InlineText text={numberedItem[2]} /></p>
            </div>
          );
        }

        return <p key={key} className="text-[15px] text-[#2c2c2e]"><InlineText text={trimmed} /></p>;
}

function getSectionLabel(block: string, index: number) {
  const text = block.trim();
  if (/^#{1,4}\s+/.test(text) || /^(\d+)[.)]\s+/.test(text)) return null;
  if (/^(또한|추가로|다만|주의)/.test(text)) return "추가 확인";
  if (/^(원하시면|다음으로|정확한|확인하려면)/.test(text)) return "다음 단계";
  if (index === 0) return "핵심 안내";
  return null;
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong>
          : <span key={index}>{part}</span>
      )}
    </>
  );
}
