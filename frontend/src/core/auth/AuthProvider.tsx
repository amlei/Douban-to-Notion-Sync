"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { UserProfile } from "./types";
import * as authApi from "../api/auth";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string) => Promise<void>;
  verifyAndCreate: (email: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: UserProfile | null;
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser ?? null);

  const loginFn = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    setUser(user);
  }, []);

  const registerFn = useCallback(async (email: string) => {
    await authApi.register(email);
  }, []);

  const verifyAndCreateFn = useCallback(async (email: string, code: string, password: string) => {
    const { user } = await authApi.verifyAndCreate(email, code, password);
    setUser(user);
  }, []);

  const logoutFn = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await authApi.getMe();
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login: loginFn,
        register: registerFn,
        verifyAndCreate: verifyAndCreateFn,
        logout: logoutFn,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
