import { useState, useEffect, useRef, useCallback } from "react";
import "./modal-base.css";
import "./ProfileModal.css";
import { X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { AuthModal } from "./AuthModal";
import { tabs } from "./constants";
import { AccountTab } from "./AccountTab";
import { DataTab } from "./DataTab";
import { usePlatformBinding, setCommunityData } from "./usePlatformBinding";
import { getAllCommunityData, checkAllBindings } from "../../api/douban";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem, CommunityData } from "../../types/community";

interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, logout, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("general");
  const [activePlatform, setActivePlatform] = useState<string>("douban");
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Community data
  const [books, setBooks] = useState<BookItem[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [wereadBooks, setWereadBooks] = useState<BookItem[]>([]);
  const [wereadBookmarks, setWereadBookmarks] = useState<BookmarkItem[]>([]);
  const [flomoMemos, setFlomoMemos] = useState<MemoItem[]>([]);

  const applyPlatformData = useCallback((platform: string, d: CommunityData) => {
    if (platform === "douban") {
      setBooks(d.books ?? []);
      setMovies(d.movies ?? []);
      setNotes(d.notes ?? []);
    } else if (platform === "flomo") {
      setFlomoMemos(d.memos ?? []);
    } else {
      setWereadBooks(d.books ?? []);
      setWereadBookmarks(d.bookmarks ?? []);
    }
  }, []);

  const refreshCommunityData = useCallback(async () => {
    const all = await getAllCommunityData();
    for (const [pf, d] of Object.entries(all)) {
      setCommunityData(pf, d);
      applyPlatformData(pf, d);
    }
  }, [applyPlatformData]);

  const doubanBinding = usePlatformBinding("douban", wsRef, {
    onQr: setQrSrc,
    onError: setBindError,
    onBindComplete: refreshCommunityData,
  });

  const wereadBinding = usePlatformBinding("weread", wsRef, {
    onQr: setQrSrc,
    onError: setBindError,
    onBindComplete: refreshCommunityData,
    onUnbind: () => { setWereadBooks([]); setWereadBookmarks([]); },
  });

  const flomoBinding = usePlatformBinding("flomo", wsRef, {
    onQr: setQrSrc,
    onError: setBindError,
    onBindComplete: refreshCommunityData,
    onUnbind: () => { setFlomoMemos([]); },
  });

  // Load cached data on mount, fetch from API if no cache
  useEffect(() => {
    if (!user) return;

    const cd = doubanBinding.checkInitial();
    if (cd) { setBooks(cd.books ?? []); setMovies(cd.movies ?? []); setNotes(cd.notes ?? []); }
    const cw = wereadBinding.checkInitial();
    if (cw) { setWereadBooks(cw.books ?? []); setWereadBookmarks(cw.bookmarks ?? []); }
    const cf = flomoBinding.checkInitial();
    if (cf) { setFlomoMemos(cf.memos ?? []); }

    if (cd || cw || cf) return;

    (async () => {
      try {
        const [bindings, allData] = await Promise.all([checkAllBindings(), getAllCommunityData()]);
        for (const pf of ["douban", "weread", "flomo"] as const) {
          const status = bindings[pf];
          const data = allData[pf];
          if (!status || !data) continue;
          if (pf === "douban") { doubanBinding.initFromApi(status, data); setBooks(data.books ?? []); setMovies(data.movies ?? []); setNotes(data.notes ?? []); }
          else if (pf === "weread") { wereadBinding.initFromApi(status, data); setWereadBooks(data.books ?? []); setWereadBookmarks(data.bookmarks ?? []); }
          else { flomoBinding.initFromApi(status, data); setFlomoMemos(data.memos ?? []); }
        }
      } catch { /* ignore */ }
    })();
  }, [user]);

  // Cleanup WebSocket on unmount
  useEffect(() => () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  if (!user) {
    return <AuthModal onClose={onClose} />;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>设置</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        <div className="settings-layout">
          <nav className="settings-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="settings-content">
            {activeTab === "general" && (
              <div className="settings-page">
                <h3>通用设置</h3>
                <p className="settings-desc">应用偏好和显示选项。</p>
              </div>
            )}
            {activeTab === "account" && (
              <AccountTab
                user={user}
                refreshUser={refreshUser}
                logout={logout}
                books={books}
                wereadBooks={wereadBooks}
                movies={movies}
                doubanBinding={doubanBinding}
                wereadBinding={wereadBinding}
                flomoBinding={flomoBinding}
                qrSrc={qrSrc}
                bindError={bindError}
                activePlatform={activePlatform}
                onPlatformChange={setActivePlatform}
              />
            )}
            {activeTab === "data" && (
              <DataTab
                doubanBound={doubanBinding.bound}
                wereadBound={wereadBinding.bound}
                flomoBound={flomoBinding.bound}
                books={books}
                wereadBooks={wereadBooks}
                movies={movies}
                notes={notes}
                wereadBookmarks={wereadBookmarks}
                flomoMemos={flomoMemos}
              />
            )}
            {activeTab === "terms" && (
              <div className="settings-page">
                <h3>服务协议</h3>
                <p className="settings-desc">服务条款与隐私政策。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
