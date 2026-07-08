// 역할: 브라우저 DOM에 React 애플리케이션을 올리는 프론트엔드 진입점입니다.
// 흐름: index.html -> main.tsx -> App.tsx -> routes.tsx.

import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
