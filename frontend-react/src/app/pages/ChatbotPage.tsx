// 역할: 모바일/탭 화면에서 챗봇 패널을 단독 페이지로 보여줍니다.
// 흐름: routes.tsx -> ChatbotPage -> ChatbotPanel -> Django /api/chatbot -> FastAPI /api/chat.
// 다음 파일: frontend-react/src/app/components/ChatbotPanel.tsx.
import { ChatbotPanel } from "../components/ChatbotPanel";

export function ChatbotPage() {
  return (
    <div className="h-[calc(100dvh-154px)] min-h-[520px] sm:h-[calc(100dvh-166px)] lg:h-[calc(100dvh-174px)] lg:min-h-[620px]">
      <ChatbotPanel />
    </div>
  );
}
