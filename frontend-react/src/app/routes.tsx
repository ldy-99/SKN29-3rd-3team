import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Profile } from "./pages/Profile";
import { StrategyRun } from "./pages/StrategyRun";
import { ResultDetail } from "./pages/ResultDetail";
import { PdfAnalysis } from "./pages/PdfAnalysis";

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
      // To simplify, results are navigated directly via mock IDs
      { path: "/results", element: <Navigate to="/strategy" replace /> },
      { path: "/results/:id", Component: ResultDetail },
      { path: "/pdf", Component: PdfAnalysis },
    ],
  },
]);
