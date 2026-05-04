import { useState } from "react";
import "./AccountManage.css";
import "../../../auth/shared.css";
import "../../../auth/LoginModal/LoginModal.css";
import { User, Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, changePassword } from "../../../../api/auth";
import { getPasswordStrength } from "@/utils/password";
import type { StrengthLevel } from "@/utils/password";
import { STRENGTH_COLORS, STRENGTH_LABELS } from "../../../auth/LoginModal";

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

export function AccountManage() {
  const { user, refreshUser, logout } = useAuth();

  const [editField, setEditField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password modal
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  if (!user) return null;
  const currentUser = user;

  const maskEmail = (email: string) => {
    const at = email.indexOf("@");
    if (at <= 2) return email;
    return email[0] + email[1] + email[2] + "******" + email.slice(at - 3);
  };

  const startEdit = (field: string) => {
    setEditName(currentUser.name);
    setEditBio(currentUser.bio ?? "");
    setEditAvatar(null);
    setError(null);
    setEditField(field);
  };

  const cancelEdit = () => {
    setEditField(null);
    setError(null);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setEditAvatar(dataUrl);
      try {
        await updateProfile({ avatar: dataUrl });
        await refreshUser();
        setEditAvatar(null);
      } catch {
        setError("头像更新失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const saveField = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        name: editName,
        bio: editBio || undefined,
        avatar: editAvatar !== null ? editAvatar : undefined,
      });
      await refreshUser();
      setEditField(null);
    } catch {
      setError("保存失败");
    }
    setSaving(false);
  };

  const savePassword = async () => {
    setPwError(null);
    if (!pwNew || pwNew.length < 6) {
      setPwError("新密码至少需要 6 个字符");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("两次输入的密码不一致");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(pwOld, pwNew);
      setShowPwModal(false);
      setPwOld("");
      setPwNew("");
    } catch (e: any) {
      setPwError(e.message);
    }
    setPwSaving(false);
  };

  return (
    <div className="panel-modal-page">
      <div className="settings-kv-list">
        {/* Avatar row */}
        <div className="settings-kv-row">
          <span className="settings-kv-label">头像</span>
          <div className="settings-kv-value">
            <label className="avatar-editable-sm" title="更换头像">
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="avatar-sm" />
              ) : (
                <div className="avatar-sm avatar-sm-placeholder"><User size={18} /></div>
              )}
            </label>
          </div>
        </div>

        {/* Name row */}
        <div className="settings-kv-row">
          <span className="settings-kv-label">用户名</span>
          <div className="settings-kv-value">
            {editField === "name" ? (
              <>
                <input className="auth-input settings-kv-input" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <button className="settings-kv-action" onClick={saveField} disabled={saving}>
                  {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                </button>
                <button className="settings-kv-action" onClick={cancelEdit}><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="settings-kv-text">{currentUser.name}</span>
                <button className="settings-kv-action" onClick={() => startEdit("name")}><Pencil size={14} /></button>
              </>
            )}
          </div>
        </div>

        {/* Bio row */}
        <div className="settings-kv-row">
          <span className="settings-kv-label">个人简介</span>
          <div className="settings-kv-value">
            {editField === "bio" ? (
              <>
                <input className="auth-input settings-kv-input" type="text" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="一句话介绍自己" />
                <button className="settings-kv-action" onClick={saveField} disabled={saving}>
                  {saving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                </button>
                <button className="settings-kv-action" onClick={cancelEdit}><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="settings-kv-text" style={currentUser.bio ? undefined : { color: "var(--text-muted)" }}>{currentUser.bio || "未填写"}</span>
                <button className="settings-kv-action" onClick={() => startEdit("bio")}><Pencil size={14} /></button>
              </>
            )}
          </div>
        </div>

        {/* Email row (read-only) */}
        <div className="settings-kv-row">
          <span className="settings-kv-label">邮箱</span>
          <div className="settings-kv-value">
            <span className="settings-kv-text">{maskEmail(currentUser.email)}</span>
          </div>
        </div>

        {/* Password row */}
        <div className="settings-kv-row">
          <span className="settings-kv-label">密码</span>
          <div className="settings-kv-value">
            <span className="settings-kv-text">******</span>
            <button className="settings-kv-action" onClick={() => { setPwOld(""); setPwNew(""); setPwConfirm(""); setPwError(null); setShowPwModal(true); }}><Pencil size={14} /></button>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <button className="account-logout-btn" onClick={logout}>退出登录</button>
      </div>
      {showPwModal && (
        <div className="pw-modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pw-modal-header">
              <p className="pw-modal-title">修改密码</p>
              <Button icon={<X size={18} />} onClick={() => setShowPwModal(false)} />
            </div>
            <div className="pw-modal-body">
              <div className="profile-field-edit">
                <label>当前密码</label>
                <input className="auth-input" type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
              </div>
              <div className="profile-field-edit">
                <label>新密码</label>
                <input className="auth-input" type="password" placeholder="至少 6 位" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
                {pwNew && <StrengthBar level={getPasswordStrength(pwNew)} />}
              </div>
              <div className="profile-field-edit">
                <label>确认新密码</label>
                <input className="auth-input" type="password" placeholder="再次输入新密码" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
              </div>
              {pwError && <p className="auth-error">{pwError}</p>}
            </div>
            <div className="pw-modal-footer">
              <button className="auth-btn" onClick={savePassword} disabled={pwSaving}>
                {pwSaving ? <Loader2 size={14} className="spin" /> : "确认修改"}
              </button>
              <button className="account-logout-btn" onClick={() => setShowPwModal(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
