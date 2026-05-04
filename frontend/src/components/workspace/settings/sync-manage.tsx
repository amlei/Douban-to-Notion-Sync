"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePlatformBinding } from "@/core/community/use-platform-binding";
import { getAllCommunityData, checkAllBindings } from "@/core/api/community";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "@/core/community/types";
import { PlatformCard } from "@/components/workspace/data/platform-card";

const platforms = [
  { id: "douban", label: "豆瓣", icon: "/douban.svg", rounded: false },
  { id: "flomo", label: "flomo", icon: "/flomoapp.svg", rounded: false },
  { id: "weread", label: "微信读书", icon: "/weread.webp", rounded: true },
] as const;

export function useCommunityDataState() {
  const wsRef = useRef<WebSocket | null>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);

  const [books, setBooks] = useState<BookItem[]>([]);
  const [movies, setMovies] = useState<MovieItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [wereadBooks, setWereadBooks] = useState<BookItem[]>([]);
  const [wereadBookmarks, setWereadBookmarks] = useState<BookmarkItem[]>([]);
  const [flomoMemos, setFlomoMemos] = useState<MemoItem[]>([]);

  const refreshCommunityData = useCallback(async () => {
    const all = await getAllCommunityData();
    for (const [pf, d] of Object.entries(all)) {
      if (pf === "douban") {
        setBooks(d.books ?? []);
        setMovies(d.movies ?? []);
        setNotes(d.notes ?? []);
      } else if (pf === "flomo") {
        setFlomoMemos(d.memos ?? []);
      } else {
        setWereadBooks(d.books ?? []);
        setWereadBookmarks(d.bookmarks ?? []);
      }
    }
  }, []);

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

  useEffect(() => {
    (async () => {
      try {
        const [bindings, allData] = await Promise.all([checkAllBindings(), getAllCommunityData()]);
        for (const pf of ["douban", "weread", "flomo"] as const) {
          const status = bindings[pf];
          const data = allData[pf];
          if (!status || !data) continue;
          if (pf === "douban") {
            doubanBinding.initFromApi(status);
            setBooks(data.books ?? []);
            setMovies(data.movies ?? []);
            setNotes(data.notes ?? []);
          } else if (pf === "weread") {
            wereadBinding.initFromApi(status);
            setWereadBooks(data.books ?? []);
            setWereadBookmarks(data.bookmarks ?? []);
          } else {
            flomoBinding.initFromApi(status);
            setFlomoMemos(data.memos ?? []);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  return {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError,
    doubanBound: doubanBinding.bound,
    wereadBound: wereadBinding.bound,
    flomoBound: flomoBinding.bound,
    doubanBinding, wereadBinding, flomoBinding,
  };
}

export function SyncManage() {
  const [activePlatform, setActivePlatform] = useState("douban");
  const {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError,
    doubanBinding, wereadBinding, flomoBinding,
  } = useCommunityDataState();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        绑定第三方平台账号，同步你的书影音数据。
      </p>

      <div className="flex gap-1 border-b border-border">
        {platforms.map((p) => (
          <button
            key={p.id}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activePlatform === p.id
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActivePlatform(p.id)}
          >
            <div className="flex items-center gap-1.5">
              <img
                src={p.icon}
                alt={p.label}
                className={`h-4 w-4 ${p.rounded ? "rounded" : ""}`}
              />
              <span>{p.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="relative">
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
        {qrSrc && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="bg-card p-6 rounded-xl shadow-lg text-center space-y-2">
              <img src={qrSrc} alt="QR Code" className="mx-auto" />
              <p className="text-sm text-muted-foreground">
                使用{activePlatform === "weread" || activePlatform === "flomo" ? "微信" : "豆瓣 App"}扫码登录
              </p>
            </div>
          </div>
        )}
        {bindError && (
          <p className="text-sm text-destructive mt-2">{bindError}</p>
        )}
      </div>
    </div>
  );
}
