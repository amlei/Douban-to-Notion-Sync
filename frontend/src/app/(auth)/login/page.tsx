"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Mail, Lock, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/core/auth/AuthProvider";
import { getPasswordStrength } from "@/core/utils/password";
import type { StrengthLevel } from "@/core/utils/password";

const STRENGTH_COLORS: Record<StrengthLevel, [string, string, string]> = {
  0: ["hsl(var(--border))", "hsl(var(--border))", "hsl(var(--border))"],
  1: ["#ef4444", "hsl(var(--border))", "hsl(var(--border))"],
  2: ["#f59e0b", "#f59e0b", "hsl(var(--border))"],
  3: ["#22c55e", "#22c55e", "#22c55e"],
};

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: "",
  1: "弱",
  2: "中",
  3: "强",
};

function StrengthBar({ level }: { level: StrengthLevel }) {
  const colors = STRENGTH_COLORS[level];
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1">
        {colors.map((color, i) => (
          <div
            key={i}
            className="h-1 w-6 rounded-full"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {level > 0 && (
        <span className="text-xs text-muted-foreground">{STRENGTH_LABELS[level]}</span>
      )}
    </div>
  );
}

export default function LoginPage() {
  const { login, register, verifyAndCreate } = useAuth();

  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await login(authEmail, authPassword);
      window.location.href = "/workspace";
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "登录失败");
    }
    setAuthLoading(false);
  };

  const handleSendCode = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await register(authEmail);
      setCodeSent(true);
      setCooldown(60);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      cooldownRef.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(cooldownRef.current!);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "发送失败");
    }
    setAuthLoading(false);
  };

  const handleVerify = async () => {
    setAuthError(null);
    if (!authPassword || authPassword.length < 6) {
      setAuthError("密码至少需要 6 个字符");
      return;
    }
    setAuthLoading(true);
    try {
      await verifyAndCreate(authEmail, authCode, authPassword);
      window.location.href = "/workspace";
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "注册失败");
    }
    setAuthLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm bg-card rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {authView === "login" ? "登录" : "注册"}
        </h2>

        <div className="space-y-3">
          {authError && (
            <p className="text-sm text-destructive">{authError}</p>
          )}

          {authView === "login" && (
            <>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="密码"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="pl-9 pr-9"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw(!showPw)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button className="w-full" onClick={handleLogin} disabled={authLoading}>
                {authLoading ? <Loader2 size={16} className="animate-spin" /> : "登录"}
              </Button>
              <p
                className="text-sm text-primary cursor-pointer text-center"
                onClick={() => {
                  setAuthView("register");
                  setAuthError(null);
                  setCodeSent(false);
                  if (cooldownRef.current) clearInterval(cooldownRef.current);
                  setCooldown(0);
                }}
              >
                没有账号？注册
              </p>
            </>
          )}

          {authView === "register" && (
            <>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="邮箱"
                  value={authEmail}
                  onChange={(e) => {
                    setAuthEmail(e.target.value);
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    setCooldown(0);
                    setCodeSent(false);
                  }}
                  className="pl-9"
                />
              </div>
              {codeSent && (
                <p className="text-xs text-muted-foreground">
                  验证码已发送至 {authEmail}
                </p>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="6 位验证码"
                    maxLength={6}
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    disabled={!codeSent}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleSendCode}
                  disabled={authLoading || !authEmail || cooldown > 0}
                  className="shrink-0"
                >
                  {cooldown > 0 ? `${cooldown}s` : codeSent ? "重新发送" : "发送验证码"}
                </Button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="密码（至少 6 位）"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
              {authPassword && (
                <StrengthBar level={getPasswordStrength(authPassword)} />
              )}
              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={authLoading || !codeSent}
              >
                {authLoading ? <Loader2 size={16} className="animate-spin" /> : "创建账号"}
              </Button>
              <p
                className="text-sm text-primary cursor-pointer text-center"
                onClick={() => {
                  setAuthView("login");
                  setAuthError(null);
                  setCodeSent(false);
                  if (cooldownRef.current) clearInterval(cooldownRef.current);
                  setCooldown(0);
                }}
              >
                已有账号？登录
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
