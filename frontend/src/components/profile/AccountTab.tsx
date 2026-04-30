import { useState, useEffect, useRef } from "react";
import "./AccountTab.css";
import { X, User, Pencil, Check, Loader2 } from "lucide-react";
import { updateProfile } from "../../api/auth";
import { platforms } from "./constants";
import { PlatformCard } from "./PlatformCard";
import { PasswordModal } from "./PasswordModal";
import type { PlatformBindingState } from "./usePlatformBinding";
import type { BookItem, MovieItem } from "../../types/douban";

interface AccountTabProps {
  user: { name: string; email: string; avatar: string | null; bio: string | null };
  refreshUser: () => Promise<void>;
  logout: () => void;
  books: BookItem[];
  wereadBooks: BookItem[];
  movies: MovieItem[];
  doubanBinding: PlatformBindingState;
  wereadBinding: PlatformBindingState;
  qrSrc: string | null;
  bindError: string | null;
  activePlatform: string;
  onPlatformChange: (id: string) => void;
}

export function AccountTab({
  user, refreshUser, logout,
  books, wereadBooks, movies,
  doubanBinding, wereadBinding,
  qrSrc, bindError,
  activePlatform, onPlatformChange,
}: AccountTabProps) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const startEditProfile = () => {
    setEditName(user.name);
    setEditBio(user.bio ?? "");
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

  // Close account menu on outside click
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
    <div className="settings-page">
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
          {editAvatar || user.avatar ? (
            <img src={editAvatar || user.avatar!} alt="" className="profile-detail-avatar" />
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
              <span>{user.email}</span>
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
              <span>{user.name}</span>
            </div>
            <div className="profile-field">
              <label>个人简介</label>
              <span style={user.bio ? undefined : { color: "var(--text-muted)" }}>{user.bio || "一句话介绍自己"}</span>
            </div>
            <div className="profile-field">
              <label>邮箱</label>
              <span>{user.email}</span>
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
              onClick={() => onPlatformChange(p.id)}
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
            />
          )}
          {activePlatform === "weread" && (
            <PlatformCard
              platform="weread"
              icon="/weread.webp"
              iconRounded={true}
              label="微信读书"
              binding={wereadBinding}
            />
          )}
          {activePlatform !== "douban" && activePlatform !== "weread" &&
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
                <p>使用{activePlatform === "weread" ? "微信" : "豆瓣 App"}扫码登录</p>
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
      {showPwModal && <PasswordModal onClose={() => setShowPwModal(false)} />}
    </div>
  );
}
