import { useState, useEffect, useRef, useCallback } from "react";
import "./modal-base.css";
import "./ProfileModal.css";
import { X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { AuthModal } from "./AuthModal";
import { tabs } from "./constants";
import { AccountTab } from "./AccountTab";
import { DataTab } from "./DataTab";
import { usePlatformBinding } from "./usePlatformBinding";
import { getCommunityData } from "../../api/douban";
import type { BookItem, MovieItem, NoteItem, BookmarkItem } from "../../types/douban";

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

  const refreshCommunityData = useCallback(async (platform: string) => {
    const d = await getCommunityData(platform);
    if (platform === "douban") {
      setBooks(d.books ?? []);
      setMovies(d.movies ?? []);
      setNotes(d.notes ?? []);
    } else {
      setWereadBooks(d.books ?? []);
      setWereadBookmarks(d.bookmarks ?? []);
    }
  }, []);

  const doubanBinding = usePlatformBinding("douban", wsRef, {
    onQr: setQrSrc,
    onError: setBindError,
    onBindComplete: () => refreshCommunityData("douban"),
  });

  const wereadBinding = usePlatformBinding("weread", wsRef, {
    onQr: setQrSrc,
    onError: setBindError,
    onBindComplete: () => refreshCommunityData("weread"),
    onUnbind: () => { setWereadBooks([]); setWereadBookmarks([]); },
  });

  // Check bindings on mount
  useEffect(() => {
    if (!user) return;
    doubanBinding.checkInitial().then((d) => {
      if (d) { setBooks(d.books ?? []); setMovies(d.movies ?? []); setNotes(d.notes ?? []); }
    });
    wereadBinding.checkInitial().then((d) => {
      if (d) { setWereadBooks(d.books ?? []); setWereadBookmarks(d.bookmarks ?? []); }
    });
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
                books={books}
                wereadBooks={wereadBooks}
                movies={movies}
                notes={notes}
                wereadBookmarks={wereadBookmarks}
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
