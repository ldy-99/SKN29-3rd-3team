// 역할: 앱 전체 Layout과 React Router를 연결합니다.
// 흐름: main.tsx -> App.tsx -> routes.tsx -> page component.
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "./auth/AuthContext";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
