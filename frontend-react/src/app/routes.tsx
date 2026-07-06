// 역할: URL 경로와 React page component를 매핑합니다.
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { StrategyRun } from "./pages/StrategyRun";
import { ResultDetail } from "./pages/ResultDetail";
import { PdfAnalysis } from "./pages/PdfAnalysis";
import { MyPage } from "./pages/MyPage";
import { ChatbotPage } from "./pages/ChatbotPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    Component: Layout,
    children: [
      { path: "/profile", Component: Profile },
      { path: "/strategy", Component: StrategyRun },
      { path: "/mypage", Component: MyPage },
      { path: "/results", element: <Navigate to="/mypage" replace /> },
      { path: "/results/:id", Component: ResultDetail },
      { path: "/pdf", Component: PdfAnalysis },
      { path: "/chatbot", Component: ChatbotPage },
    ],
  },
]);
