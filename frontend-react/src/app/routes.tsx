// 역할: URL 경로와 React page component를 매핑합니다.
// 흐름: App.tsx -> routes.tsx -> Login/Profile/StrategyRun/ResultDetail/PdfAnalysis.
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { StrategyRun } from "./pages/StrategyRun";
import { ResultDetail } from "./pages/ResultDetail";
import { PdfAnalysis } from "./pages/PdfAnalysis";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, element: <Navigate to="/profile" replace /> },
      { path: "profile", Component: Profile },
      { path: "strategy", Component: StrategyRun },
      // To simplify, results are navigated directly via mock IDs
      { path: "results", element: <Navigate to="/strategy" replace /> },
      { path: "results/:id", Component: ResultDetail },
      { path: "pdf", Component: PdfAnalysis },
    ],
  },
]);
