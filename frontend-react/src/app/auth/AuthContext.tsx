// 역할: React 전역에서 Django session 기반 로그인 상태를 공유합니다.
// 흐름: App.tsx -> AuthProvider -> api.getMe/logout -> Layout/Login/SiteHeader 보호 라우팅.
// 다음 파일: frontend-react/src/app/api/client.ts, frontend-react/src/app/components/Layout.tsx.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, type CurrentUser } from "../api/client";

type AuthContextValue = {
  user: CurrentUser | null;
  isLoading: boolean;
  setAuthenticatedUser: (user: CurrentUser) => void;
  refreshUser: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await api.getMe();
      setUser(currentUser);
      return currentUser;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      setAuthenticatedUser: setUser,
      refreshUser,
      logout,
    }),
    [isLoading, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
