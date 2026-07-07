// 역할: 모바일/탭 화면에서 챗봇 패널을 단독 페이지로 보여줍니다.
// 흐름: routes.tsx -> ChatbotPage -> ChatbotPanel -> Django /api/chatbot -> FastAPI /api/chat.
// 다음 파일: frontend-react/src/app/components/ChatbotPanel.tsx.
import { ChatbotPanel } from "../components/ChatbotPanel";

export function ChatbotPage() {
  return (
    <div className="mx-auto h-[calc(100dvh-176px)] min-h-[500px] max-w-[1040px] sm:h-[calc(100dvh-188px)] lg:h-[calc(100dvh-206px)] lg:min-h-[560px]">
      <ChatbotPanel />
    </div>
  );
}
