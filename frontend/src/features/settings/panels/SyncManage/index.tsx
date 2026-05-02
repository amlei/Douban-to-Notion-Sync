import { PlatformCard } from "../../components/PlatformCard";
import { useCommunityData } from "../../hooks/useCommunityData";
import "./SyncManage.css";

const platforms = [
  { id: "douban", label: "豆瓣", icon: "/douban.svg", rounded: false },
  { id: "flomo", label: "flomo", icon: "/flomoapp.svg", rounded: false },
  { id: "weread", label: "微信读书", icon: "/weread.webp", rounded: true },
] as const;

export function SyncManage() {
  const {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError, activePlatform,
    doubanBinding, wereadBinding, flomoBinding,
    setActivePlatform,
  } = useCommunityData();

  return (
    <div className="panel-modal-page">
      <p className="panel-modal-desc">绑定第三方平台账号，同步你的书影音数据。</p>
      <div className="platform-section">
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
    </div>
  );
}
