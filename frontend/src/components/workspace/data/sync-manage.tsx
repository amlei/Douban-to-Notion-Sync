"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Plus } from "lucide-react";
import { usePlatformBinding } from "@/core/community/use-platform-binding";
import { getAllCommunityData, checkAllBindings } from "@/core/community/api";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "@/core/community/types";
import { PlatformCard } from "@/components/workspace/data/platform-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [modalOpen, setModalOpen] = useState(false);
  const {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError,
    doubanBinding, wereadBinding, flomoBinding,
  } = useCommunityDataState();

  const bindingMap: Record<string, typeof doubanBinding> = {
    douban: doubanBinding,
    weread: wereadBinding,
    flomo: flomoBinding,
  };

  const dataCountsMap: Record<string, Record<string, number>> = {
    douban: { "本图书": books.length, "部电影": movies.length, "篇日记": notes.length },
    weread: { "本图书": wereadBooks.length, "条笔记": wereadBookmarks.length },
    flomo: { "条备忘录": flomoMemos.length },
  };

  const boundPlatforms = platforms.filter((p) => bindingMap[p.id].bound);
  const bindingPlatform = platforms.find((p) => bindingMap[p.id].binding);
  // Include platform currently being bound so the card + QR overlay render
  const displayedPlatforms = bindingPlatform && !bindingMap[bindingPlatform.id].bound
    ? [...boundPlatforms, bindingPlatform]
    : boundPlatforms;
  const unboundPlatforms = platforms.filter(
    (p) => !bindingMap[p.id].bound && !bindingMap[p.id].binding,
  );
  const showEmptyState = displayedPlatforms.length === 0;

  function handleModalSelect(platformId: string) {
    setModalOpen(false);
    bindingMap[platformId].handleBind();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        绑定第三方平台账号，同步你的书影音数据。
      </p>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <p className="text-sm text-muted-foreground">暂未绑定平台</p>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            绑定平台
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-4">
            {displayedPlatforms.map((p) => (
              <PlatformCard
                key={p.id}
                platform={p.id}
                icon={p.icon}
                iconRounded={p.rounded}
                label={p.label}
                binding={bindingMap[p.id]}
                dataCounts={dataCountsMap[p.id]}
              />
            ))}
            {unboundPlatforms.length > 0 && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center justify-center rounded-lg border border-dashed border-border h-[120px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer"
              >
                <Plus size={20} />
                <span className="ml-2 text-sm font-medium">添加平台</span>
              </button>
            )}
          </div>

          {bindingPlatform && (() => {
            const bp = bindingMap[bindingPlatform.id];
            const statusText =
              bp.scrapePhase === "books" ? "正在导入图书..."
              : bp.scrapePhase === "movies" ? "正在导入影视..."
              : bp.scrapePhase === "bookmarks" ? "正在导入笔记..."
              : bp.scrapePhase === "memos" ? "正在下载备忘录..."
              : bp.bindPhase === "scanned" ? "扫码成功，等待确认..."
              : bp.bindPhase === "logged_in" ? "登录成功，正在获取资料..."
              : bp.bindPhase === "fetching_profile" ? "正在获取资料..."
              : "正在启动浏览器...";
            const scanner = bindingPlatform.id === "weread" || bindingPlatform.id === "flomo" ? "微信" : "豆瓣 App";
            return (
              <div className="fixed inset-0 flex items-center justify-center bg-background/80 z-50">
                <div className="bg-card p-8 rounded-xl shadow-lg text-center space-y-4 min-w-[280px]">
                  {qrSrc ? (
                    <>
                      <img src={qrSrc} alt="QR Code" className="mx-auto max-w-[240px]" />
                      <p className="text-sm text-muted-foreground">
                        请使用{scanner}扫码登录
                      </p>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Loader2 size={32} className="animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">{statusText}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {bindError && (
        <p className="text-sm text-destructive">{bindError}</p>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>选择平台</DialogTitle>
            <DialogDescription>选择要绑定的第三方平台</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            {unboundPlatforms.map((p) => (
              <button
                key={p.id}
                onClick={() => handleModalSelect(p.id)}
                className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors text-left w-full"
              >
                <img
                  src={p.icon}
                  alt={p.label}
                  className={`h-8 w-8 ${p.rounded ? "rounded" : ""}`}
                />
                <span className="font-medium text-foreground">{p.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
