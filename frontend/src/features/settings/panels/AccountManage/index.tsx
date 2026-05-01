import { useState, useEffect, useRef } from "react";
import "./AccountManage.css";
import "../../../auth/shared.css";
import "../../../auth/LoginModal/LoginModal.css";
import { X, User, Pencil, Check, Loader2 } from "lucide-react";
import { useAuth } from "../../../../contexts/AuthContext";
import { updateProfile, changePassword } from "../../../../api/auth";
import { getPasswordStrength } from "../../../../utils/password";
import type { StrengthLevel } from "../../../../utils/password";
import { STRENGTH_COLORS, STRENGTH_LABELS } from "../../../auth/LoginModal";
import { PlatformCard } from "../../components/PlatformCard";
import { useCommunityData } from "../../hooks/useCommunityData";

const platforms = [
  { id: "douban", label: "豆瓣", icon: "/douban.svg", rounded: false },
  { id: "flomo", label: "flomo", icon: "/flomoapp.svg", rounded: false },
  { id: "weread", label: "微信读书", icon: "/weread.webp", rounded: true },
] as const;

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
  const {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError, activePlatform,
    doubanBinding, wereadBinding, flomoBinding,
    setActivePlatform,
  } = useCommunityData();

  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  // Password modal state
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  if (!user) return null;

  const currentUser = user;

  const startEditProfile = () => {
    setEditName(currentUser.name);
    setEditBio(currentUser.bio ?? "");
    setEditAvatar(null);
    setProfileError(null);
    setEditingProfile(true);
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
        setProfileError("头像更新失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      await updateProfile({
        name: editName,
        bio: editBio || undefined,
        avatar: editAvatar !== null ? editAvatar : undefined,
      });
      await refreshUser();
      setEditingProfile(false);
    } catch {
      setProfileError("保存失败");
    }
    setProfileSaving(false);
  };

  const handleChangePassword = async () => {
    setPwError(null);
    if (!pwNew || pwNew.length < 6) {
      setPwError("新密码至少需要 6 个字符");
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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    if (accountMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [accountMenuOpen]);

  return (
    <div className="panel-modal-page">
      <h3 className="settings-title-row">
        帐号管理
        <span className="settings-title-actions">
          {editingProfile ? (
            <>
              <button className="icon-btn" onClick={handleSaveProfile} disabled={profileSaving} title="保存">
                {profileSaving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
              </button>
              <button className="icon-btn" onClick={() => setEditingProfile(false)} title="取消">
                <X size={16} />
              </button>
            </>
          ) : (
            <div className="dropdown-wrapper" ref={accountMenuRef}>
              <button className="icon-btn" onClick={() => setAccountMenuOpen(v => !v)} title="编辑">
                <Pencil size={16} />
              </button>
              {accountMenuOpen && (
                <div className="account-dropdown">
                  <button className="account-dropdown-item" onClick={() => { setAccountMenuOpen(false); startEditProfile(); }}>
                    修改资料
                  </button>
                  <button className="account-dropdown-item" onClick={() => { setAccountMenuOpen(false); setShowPwModal(true); }}>
                    修改密码
                  </button>
                </div>
              )}
            </div>
          )}
        </span>
      </h3>
      <div className="settings-profile">
        <label className="profile-avatar-lg avatar-editable" title="更换头像">
          <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          {editAvatar || currentUser.avatar ? (
            <img src={editAvatar || currentUser.avatar!} alt="" className="profile-detail-avatar" />
          ) : (
            <User size={40} />
          )}
          <span className="avatar-edit-hint">更换</span>
        </label>
        {editingProfile ? (
          <div className="profile-grid">
            <div className="profile-field-edit">
              <label>用户名</label>
              <input
                className="auth-input"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="profile-field-edit">
              <label>个人简介</label>
              <input
                className="auth-input"
                type="text"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="一句话介绍自己"
              />
            </div>
            <div className="profile-field">
              <label>邮箱</label>
              <span>{currentUser.email}</span>
            </div>
            <div className="profile-field">
              <strong>{books.length + wereadBooks.length}</strong>
              <span>已读图书</span>
            </div>
            {profileError && <p className="auth-error">{profileError}</p>}
          </div>
        ) : (
          <div className="profile-grid">
            <div className="profile-field">
              <label>用户名</label>
              <span>{currentUser.name}</span>
            </div>
            <div className="profile-field">
              <label>个人简介</label>
              <span style={currentUser.bio ? undefined : { color: "var(--text-muted)" }}>{currentUser.bio || "一句话介绍自己"}</span>
            </div>
            <div className="profile-field">
              <label>邮箱</label>
              <span>{currentUser.email}</span>
            </div>
            <div className="profile-field">
              <strong>{books.length + wereadBooks.length}</strong>
              <span>已读图书</span>
            </div>
            <div className="profile-field">
              <strong>{movies.length}</strong>
              <span>已看电影</span>
            </div>
          </div>
        )}
      </div>
      <div className="platform-section">
        <h4>第三方平台绑定</h4>
        <div className="platform-tabs">
          {platforms.map((p) => (
            <button
              key={p.id}
              className={`platform-tab ${activePlatform === p.id ? "active" : ""}`}
              onClick={() => setActivePlatform(p.id)}
            >
              <img
                src={p.icon}
                alt={p.label}
                className={`platform-icon ${p.rounded ? "rounded" : ""}`}
              />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
        <div className="platform-panel">
          {activePlatform === "douban" && (
            <PlatformCard
              platform="douban"
              icon="/douban.svg"
              iconRounded={false}
              label="豆瓣"
              binding={doubanBinding}
              dataCounts={{ "本图书": books.length, "部电影": movies.length, "篇日记": notes.length }}
            />
          )}
          {activePlatform === "weread" && (
            <PlatformCard
              platform="weread"
              icon="/weread.webp"
              iconRounded={true}
              label="微信读书"
              binding={wereadBinding}
              dataCounts={{ "本图书": wereadBooks.length, "条笔记": wereadBookmarks.length }}
            />
          )}
          {activePlatform === "flomo" && (
            <PlatformCard
              platform="flomo"
              icon="/flomoapp.svg"
              iconRounded={false}
              label="flomo"
              binding={flomoBinding}
              dataCounts={{ "条备忘录": flomoMemos.length }}
            />
          )}
          {activePlatform !== "douban" && activePlatform !== "weread" && activePlatform !== "flomo" &&
            (() => {
              const p = platforms.find((x) => x.id === activePlatform)!;
              return (
                <div className="platform-binding">
                  <div className="platform-info">
                    <img
                      src={p.icon}
                      alt={p.label}
                      className={`platform-icon ${p.rounded ? "rounded" : ""}`}
                    />
                    <span className="platform-name">{p.label}</span>
                  </div>
                  <button className="platform-bind-btn" disabled>
                    即将支持
                  </button>
                </div>
              );
            })()}
          {qrSrc && (
            <div className="qr-overlay">
              <div className="qr-card">
                <img src={qrSrc} alt="QR Code" className="qr-image" />
                <p>使用{activePlatform === "weread" || activePlatform === "flomo" ? "微信" : "豆瓣 App"}扫码登录</p>
              </div>
            </div>
          )}
          {bindError && (
            <p className="bind-error">{bindError}</p>
          )}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <button className="platform-bind-btn unbind" onClick={logout}>
          退出登录
        </button>
      </div>
      {showPwModal && (
        <div className="pw-modal-overlay" onClick={() => setShowPwModal(false)}>
          <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pw-modal-header">
              <h3>修改密码</h3>
              <button className="modal-close" onClick={() => setShowPwModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="pw-modal-body">
              <div className="profile-field-edit">
                <label>当前密码</label>
                <input
                  className="auth-input"
                  type="password"
                  value={pwOld}
                  onChange={(e) => setPwOld(e.target.value)}
                />
              </div>
              <div className="profile-field-edit">
                <label>新密码</label>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="至少 6 位"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                />
                {pwNew && <StrengthBar level={getPasswordStrength(pwNew)} />}
              </div>
              {pwError && <p className="auth-error">{pwError}</p>}
            </div>
            <div className="pw-modal-footer">
              <button className="auth-btn" onClick={handleChangePassword} disabled={pwSaving}>
                {pwSaving ? <Loader2 size={14} className="spin" /> : "确认修改"}
              </button>
              <button className="platform-bind-btn" onClick={() => setShowPwModal(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
