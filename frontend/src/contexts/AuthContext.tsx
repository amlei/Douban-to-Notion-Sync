import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserProfile } from "../types";
import * as authApi from "../api/auth";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string) => Promise<void>;
  verifyAndCreate: (email: string, code: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    authApi.clearAuth();
    setUser(null);
  }, []);

  useEffect(() => {
    authApi.setOnUnauthorized(logout);
  }, [logout]);

  useEffect(() => {
    const auth = authApi.getAuth();
    if (auth) {
      setUser(auth.user);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    authApi.saveAuth(tokens);
    setUser(tokens.user);
  }, []);

  const register = useCallback(async (email: string) => {
    await authApi.register(email);
  }, []);

  const verifyAndCreate = useCallback(async (email: string, code: string, password: string) => {
    const tokens = await authApi.verifyAndCreate(email, code, password);
    authApi.saveAuth(tokens);
    setUser(tokens.user);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await authApi.getMe();
    setUser(u);
    const auth = authApi.getAuth();
    if (auth) {
      auth.user = u;
      localStorage.setItem("auth", JSON.stringify(auth));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyAndCreate, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
