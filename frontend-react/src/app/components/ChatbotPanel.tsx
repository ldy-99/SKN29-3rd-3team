import { useState, useRef, useEffect } from "react";
import { Send, Bot, Info, ArrowUp } from "lucide-react";
import { useLocation } from "react-router";
import { api } from "../api/client";

type Message = {
  id: number;
  type: "user" | "bot";
  content: string;
};

export function ChatbotPanel() {
  const location = useLocation();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getContextMessage = () => {
    if (location.pathname.includes("/profile")) return "현재 프로필 정보를 기준으로 답변해 드릴 수 있어요.";
    if (location.pathname.includes("/strategy")) return "입력하신 공고나 기본 전략에 대해 질문해 보세요.";
    if (location.pathname.includes("/pdf")) return "추출된 정보에 대해 궁금한 점을 알려주세요.";
    if (location.pathname.includes("/results")) return "이 결과에 대해 추가로 궁금한 점이 있으신가요?";
    return "무엇이든 물어보세요.";
  };

  const getRecommendedQuestions = () => {
    if (location.pathname.includes("/profile")) {
      return ["이 항목을 비워도 되나요?", "무주택 기간은 어떻게 계산하나요?"];
    }
    if (location.pathname.includes("/strategy")) {
      return ["이 공고에 지원 가능할까요?", "기본 진단은 어떤 것을 확인하나요?"];
    }
    if (location.pathname.includes("/pdf")) {
      return ["추출이 잘못된 것 같으면 어떡하나요?", "분양가 기준이 어떻게 되나요?"];
    }
    if (location.pathname.includes("/results")) {
      return ["부족한 정보는 무엇인가요?", "점수를 올리려면 어떻게 해야 하나요?"];
    }
    return ["청약 1순위 조건이 무엇인가요?", "생애최초 특별공급이란?"];
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: "안녕하세요. 청약 도우미입니다. " + getContextMessage(),
    }
  ]);

  // Update greeting when location changes significantly
  useEffect(() => {
    if (messages.length <= 2) {
      setMessages([{
        id: Date.now(),
        type: "bot",
        content: "안녕하세요. 청약 도우미입니다. " + getContextMessage(),
      }]);
    }
  }, [location.pathname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const newMsg: Message = { id: Date.now(), type: "user", content: text };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await api.askChatbot({ question: text, session_id: chatSessionId });
      setChatSessionId(response.session_id);
      setIsTyping(false);
      const botResponse: Message = {
        id: Date.now() + 1,
        type: "bot",
        content: `${response.answer}${response.sources?.length ? `\n\n출처: ${response.sources.join(", ")}` : ""}`,
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: "bot",
        content: error instanceof Error ? error.message : "챗봇 요청에 실패했습니다.",
      }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-[#e5e5e7] rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden relative">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e5e5e7] bg-white/80 backdrop-blur-md flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#007aff]/10 flex items-center justify-center text-[#007aff]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[15px] text-[#1d1d1f]">청약 도우미</h3>
            <p className="text-[11px] text-[#6e6e73] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></span>
              현재 화면 맥락 참조 중
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#fcfcfd]">
        <div className="text-center">
          <p className="text-[11px] text-[#6e6e73] bg-[#f5f5f7] inline-block px-3 py-1 rounded-full">
            이 대화는 DB에 저장되지 않으며 새로고침 시 사라집니다.
          </p>
        </div>

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} max-w-full`}>
            <div className={`max-w-[85%] ${msg.type === 'user' ? 'order-1' : 'order-2'}`}>
              <div className={`px-4 py-3 rounded-[20px] text-[14px] leading-relaxed ${
                msg.type === 'user' 
                  ? 'bg-[#007aff] text-white rounded-br-sm' 
                  : 'bg-[#e5e5ea] text-[#1d1d1f] rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#e5e5ea] px-4 py-3 rounded-[20px] rounded-bl-sm flex gap-1 items-center h-10">
              <div className="w-1.5 h-1.5 bg-[#6e6e73] rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-[#6e6e73] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 bg-[#6e6e73] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-[#e5e5e7] shrink-0">
        {/* Recommended Questions */}
        {messages.length < 5 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {getRecommendedQuestions().map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="text-[13px] px-3 py-1.5 rounded-full border border-[#007aff]/30 text-[#007aff] bg-[#007aff]/5 hover:bg-[#007aff]/10 transition-colors text-left"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
            placeholder="청약 도우미에게 메시지..."
            className="w-full bg-[#f5f5f7] border border-transparent rounded-[20px] pl-4 pr-10 py-2.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-[#007aff] focus:border-[#007aff] focus:bg-white transition-colors"
            disabled={isTyping}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isTyping}
            className="absolute right-1.5 w-7 h-7 bg-[#007aff] text-white rounded-full flex items-center justify-center disabled:opacity-30 disabled:bg-[#8e8e93] transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
