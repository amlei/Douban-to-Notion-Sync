import { useState } from "react";
import "./PasswordModal.css";
import { X, Loader2 } from "lucide-react";
import { getPasswordStrength } from "../../utils/password";
import type { StrengthLevel } from "../../utils/password";
import { changePassword } from "../../api/auth";
import { STRENGTH_COLORS, STRENGTH_LABELS } from "./constants";

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

export function PasswordModal({ onClose }: { onClose: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleSubmit = async () => {
    setPwError(null);
    if (!newPw || newPw.length < 6) {
      setPwError("新密码至少需要 6 个字符");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(oldPw, newPw);
      onClose();
    } catch (e: any) {
      setPwError(e.message);
    }
    setPwSaving(false);
  };

  return (
    <div className="pw-modal-overlay" onClick={onClose}>
      <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pw-modal-header">
          <h3>修改密码</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="pw-modal-body">
          <div className="profile-field-edit">
            <label>当前密码</label>
            <input
              className="auth-input"
              type="password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
            />
          </div>
          <div className="profile-field-edit">
            <label>新密码</label>
            <input
              className="auth-input"
              type="password"
              placeholder="至少 6 位"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            {newPw && <StrengthBar level={getPasswordStrength(newPw)} />}
          </div>
          {pwError && <p className="auth-error">{pwError}</p>}
        </div>
        <div className="pw-modal-footer">
          <button className="auth-btn" onClick={handleSubmit} disabled={pwSaving}>
            {pwSaving ? <Loader2 size={14} className="spin" /> : "确认修改"}
          </button>
          <button className="platform-bind-btn" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
