import { Loader2, RefreshCw, ChevronDown } from "lucide-react";
import type { PlatformBindingState } from "./usePlatformBinding";

interface PlatformCardProps {
  platform: string;
  icon: string;
  iconRounded: boolean;
  label: string;
  binding: PlatformBindingState;
}

export function PlatformCard({ platform, icon, iconRounded, label, binding }: PlatformCardProps) {
  const {
    bound, profile, binding: isBinding, bindPhase,
    refreshing, syncing, syncPhase, scrapePhase, scrapeCounts,
    menuOpen, menuRef,
    handleBind, handleUnbind, handleRefresh, handleSync, setMenuOpen,
  } = binding;

  const syncPhaseLabels: Record<string, string> = platform === "douban"
    ? { books: "正在同步图书...", movies: "正在同步影视..." }
    : { books: "正在同步图书...", bookmarks: "正在同步笔记..." };

  const bindPhaseLabels: Record<string, string> = platform === "douban"
    ? { books: "正在导入图书...", movies: "正在导入影视..." }
    : { books: "正在导入图书...", bookmarks: "正在导入笔记..." };

  const statusText = () => {
    if (platform === "douban") {
      if (scrapeCounts.books != null && scrapeCounts.movies != null) {
        return <> - 已导入 {scrapeCounts.books} 本图书, {scrapeCounts.movies} 部电影</>;
      }
    } else {
      if (scrapeCounts.books != null && scrapeCounts.bookmarks != null) {
        return <> - 已导入 {scrapeCounts.books} 本图书, {scrapeCounts.bookmarks} 条笔记</>;
      }
    }
    return null;
  };

  return (
    <div className="platform-binding-card">
      <div className="platform-binding-row">
        <div className="platform-info">
          <img src={icon} alt={label} className={`platform-icon ${iconRounded ? "rounded" : ""}`} />
          <div className="platform-detail">
            <span className="platform-name">{label}</span>
            {bound && profile && (
              <span className="platform-status">
                已绑定 ({profile.name ?? profile.user_id})
                {statusText()}
              </span>
            )}
          </div>
        </div>
        {bound ? (
          <div className="platform-actions">
            <div className="dropdown-wrapper" ref={menuRef}>
              <button
                className="platform-bind-btn"
                onClick={() => setMenuOpen((v) => !v)}
                disabled={refreshing || syncing}
              >
                {refreshing || syncing ? (
                  <>
                    <Loader2 size={14} className="spin" />
                    {refreshing && "更新中"}
                    {syncing && syncPhase && syncPhaseLabels[syncPhase]}
                    {syncing && !syncPhase && "同步中..."}
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    更新信息
                    <ChevronDown size={12} />
                  </>
                )}
              </button>
              {menuOpen && (
                <div className="dropdown-menu">
                  <button className="dropdown-item" onClick={handleRefresh}>
                    更新个人信息
                  </button>
                  <button className="dropdown-item" onClick={handleSync}>
                    同步数据
                  </button>
                </div>
              )}
            </div>
            <button className="platform-bind-btn unbind" onClick={handleUnbind}>
              解绑
            </button>
          </div>
        ) : (
          <button className="platform-bind-btn" onClick={handleBind} disabled={isBinding}>
            {isBinding ? (
              <>
                <Loader2 size={14} className="spin" />
                {bindPhase === "pending" && "等待扫码"}
                {bindPhase === "scanned" && "扫码成功，请在手机确认"}
                {bindPhase === "logged_in" && "登录成功"}
                {bindPhase === "fetching_profile" && "正在获取用户资料"}
                {bindPhase === "scraping" && scrapePhase && bindPhaseLabels[scrapePhase]}
              </>
            ) : (
              "绑定"
            )}
          </button>
        )}
      </div>
      {bound && profile && (
        <div className="platform-profile-detail">
          {profile.avatar && (
            <img className="profile-detail-avatar" src={profile.avatar} alt="" />
          )}
          <div className="profile-detail-grid">
            {profile.name && (
              <div className="profile-field">
                <label>昵称</label>
                <span>{profile.name}</span>
              </div>
            )}
            {platform === "douban" && profile.signature && (
              <div className="profile-field">
                <label>签名</label>
                <span>{profile.signature}</span>
              </div>
            )}
            {profile.location && (
              <div className="profile-field">
                <label>IP属地</label>
                <span>{profile.location}</span>
              </div>
            )}
            {platform === "douban" && profile.join_date && (
              <div className="profile-field">
                <label>加入时间</label>
                <span>{profile.join_date}</span>
              </div>
            )}
            {platform === "douban" && profile.bio && (
              <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                <label>简介</label>
                <span>{profile.bio}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
