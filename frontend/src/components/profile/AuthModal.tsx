import { useState, useEffect, useRef } from "react";
import "./AuthModal.css";
import "./modal-base.css";
import "./PasswordModal.css";
import { X, Loader2, Mail, Lock, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getPasswordStrength } from "../../utils/password";
import type { StrengthLevel } from "../../utils/password";
import { STRENGTH_COLORS, STRENGTH_LABELS } from "./constants";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
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
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await login(authEmail, authPassword);
    } catch (e: any) {
      setAuthError(e.message);
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
          if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      setAuthError(e.message);
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
    } catch (e: any) {
      setAuthError(e.message);
    }
    setAuthLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal auth-modal">
        <div className="modal-header">
          <h2>{authView === "login" ? "登录" : "注册"}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        <div className="auth-form">
          {authError && <p className="auth-error">{authError}</p>}

          {authView === "login" && (
            <>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  className="auth-input has-icon"
                  type="email"
                  placeholder="邮箱"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                />
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  className="auth-input has-icon has-toggle"
                  type={showLoginPw ? "text" : "password"}
                  placeholder="密码"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowLoginPw(!showLoginPw)}
                  tabIndex={-1}
                >
                  {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button className="auth-btn" onClick={handleLogin} disabled={authLoading}>
                {authLoading ? <Loader2 size={16} className="spin" /> : "登录"}
              </button>
              <p className="auth-link" onClick={() => { setAuthView("register"); setAuthError(null); setCodeSent(false); if (cooldownRef.current) clearInterval(cooldownRef.current); setCooldown(0); }}>
                没有账号？注册
              </p>
            </>
          )}

          {authView === "register" && (
            <>
              <div className="auth-input-wrap">
                <Mail size={16} className="auth-input-icon" />
                <input
                  className="auth-input has-icon"
                  type="email"
                  placeholder="邮箱"
                  value={authEmail}
                  onChange={(e) => {
                    setAuthEmail(e.target.value);
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                    setCooldown(0);
                    setCodeSent(false);
                  }}
                />
              </div>
              {codeSent && <p className="auth-hint">验证码已发送至 {authEmail}</p>}
              <div className="auth-code-row">
                <div className="auth-input-wrap" style={{ flex: 1 }}>
                  <KeyRound size={16} className="auth-input-icon" />
                  <input
                    className="auth-input has-icon auth-code-input"
                    type="text"
                    placeholder="6 位验证码"
                    maxLength={6}
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                    disabled={!codeSent}
                  />
                </div>
                <button
                  className="auth-btn auth-code-btn"
                  onClick={handleSendCode}
                  disabled={authLoading || !authEmail || cooldown > 0}
                >
                  {cooldown > 0 ? `${cooldown}s` : codeSent ? "重新发送" : "发送验证码"}
                </button>
              </div>
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-icon" />
                <input
                  className="auth-input has-icon has-toggle"
                  type={showRegPw ? "text" : "password"}
                  placeholder="密码（至少 6 位）"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowRegPw(!showRegPw)}
                  tabIndex={-1}
                >
                  {showRegPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {authPassword && <StrengthBar level={getPasswordStrength(authPassword)} />}
              <button
                className="auth-btn"
                onClick={handleVerify}
                disabled={authLoading || !codeSent}
              >
                {authLoading ? <Loader2 size={16} className="spin" /> : "创建账号"}
              </button>
              <p className="auth-link" onClick={() => { setAuthView("login"); setAuthError(null); setCodeSent(false); if (cooldownRef.current) clearInterval(cooldownRef.current); setCooldown(0); }}>
                已有账号？登录
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StrengthBar({ level }: { level: StrengthLevel }) {
  const colors = STRENGTH_COLORS[level];
  return (
    <div className="pw-strength">
      <div className="pw-strength-bars">
        {colors.map((color, i) => (
          <div key={i} className="pw-strength-seg" style={{ backgroundColor: color }} />
        ))}
      </div>
      {level > 0 && <span className="pw-strength-label">{STRENGTH_LABELS[level]}</span>}
    </div>
  );
}
