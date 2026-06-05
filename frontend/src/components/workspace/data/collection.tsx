"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "@/core/community/types";
import { useInfiniteBooks, useInfiniteMovies, useInfiniteNotes, useInfiniteBookmarks, useInfiniteMemos, useBookHighlights, useBookThoughts } from "@/core/community/queries";

type DataTabKey = "books" | "movies" | "bookmarks" | "memos";

type DetailItem =
  | { type: "book"; data: BookItem }
  | { type: "movie"; data: MovieItem }
  | { type: "memo"; data: MemoItem };

const SEARCH_PLACEHOLDERS: Record<DataTabKey, string> = {
  books: "搜索图书...",
  movies: "搜索电影...",
  bookmarks: "搜索读书笔记...",
  memos: "搜索 flomo 笔记...",
};

interface SortOption { value: string; label: string; }

const SORT_OPTIONS: Record<DataTabKey, SortOption[]> = {
  books: [
    { value: "default", label: "默认排序" },
    { value: "title", label: "按标题" },
    { value: "rating", label: "按评分" },
    { value: "read_date", label: "按阅读日期" },
  ],
  movies: [
    { value: "default", label: "默认排序" },
    { value: "title", label: "按标题" },
    { value: "rating", label: "按评分" },
    { value: "watch_date", label: "按观影日期" },
  ],
  bookmarks: [
    { value: "default", label: "默认排序" },
    { value: "book_title", label: "按书名" },
    { value: "create_time", label: "按创建时间" },
  ],
  memos: [
    { value: "default", label: "默认排序" },
    { value: "created_at", label: "按创建时间" },
  ],
};

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

// ---- WeRead book annotations (highlights + thoughts) in detail modal ----

interface ChapterGroup {
  chapterName: string;
  highlights: { markText: string; bookmarkId: string; thoughts: NoteItem[] }[];
  standaloneThoughts: NoteItem[];
}

function groupByChapter(bookmarks: BookmarkItem[], notes: NoteItem[]): ChapterGroup[] {
  const chapterMap = new Map<string, ChapterGroup>();

  function getOrCreate(name: string) {
    const key = name || "未知章节";
    if (!chapterMap.has(key)) chapterMap.set(key, { chapterName: key, highlights: [], standaloneThoughts: [] });
    return chapterMap.get(key)!;
  }

  // Add bookmarks
  for (const bm of bookmarks) {
    const ch = getOrCreate(bm.chapter_name ?? `第${bm.chapter_idx}章`);
    ch.highlights.push({ markText: bm.mark_text, bookmarkId: bm.bookmark_id ?? `${bm.book_id}-${bm.chapter_idx}`, thoughts: [] });
  }

  // Match notes to bookmarks via abstract, or add as standalone
  for (const n of notes) {
    const ch = getOrCreate(n.chapter_name ?? n.location ?? "");
    const abstract = n.abstract?.trim();
    let matched = false;
    if (abstract) {
      for (const h of ch.highlights) {
        if (h.markText.includes(abstract) || abstract.includes(h.markText)) {
          h.thoughts.push(n);
          matched = true;
          break;
        }
      }
    }
    if (!matched) ch.standaloneThoughts.push(n);
  }

  return Array.from(chapterMap.values());
}

function WereadBookAnnotations({ bookId }: { bookId: string }) {
  const hlQuery = useBookHighlights(bookId);
  const thQuery = useBookThoughts(bookId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const highlights = hlQuery.data?.pages.flatMap((p: { items: any[] }) => p.items).filter(Boolean) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const thoughts = thQuery.data?.pages.flatMap((p: { items: any[] }) => p.items).filter(Boolean) ?? [];

  const hlTotal = hlQuery.data?.pages[0]?.total ?? 0;
  const thTotal = thQuery.data?.pages[0]?.total ?? 0;

  const hlHasMore = hlQuery.hasNextPage;
  const thHasMore = thQuery.hasNextPage;

  // Auto-load more when scrolling to bottom
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (hlHasMore && !hlQuery.isFetchingNextPage) hlQuery.fetchNextPage();
      if (thHasMore && !thQuery.isFetchingNextPage) thQuery.fetchNextPage();
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hlHasMore, thHasMore, hlQuery.isFetchingNextPage, thQuery.isFetchingNextPage, hlQuery.fetchNextPage, thQuery.fetchNextPage]);

  if (hlQuery.isLoading || thQuery.isLoading) {
    return <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>;
  }

  if (highlights.length === 0 && thoughts.length === 0) return null;

  const chapters = groupByChapter(highlights as BookmarkItem[], thoughts as NoteItem[]);

  return (
    <div className="space-y-3 mt-4 pt-4 border-t">
      <h3 className="text-sm font-medium text-foreground">划线与想法 ({hlTotal + thTotal})</h3>
      {chapters.map((ch) => (
        <div key={ch.chapterName} className="space-y-2">
          <div className="text-xs text-muted-foreground font-medium">{ch.chapterName}</div>
          {ch.highlights.map((h) => (
            <div key={h.bookmarkId} className="space-y-1">
              <div className="text-sm border-l-2 border-primary/30 pl-3 py-1 bg-primary/5 rounded-r leading-relaxed">{h.markText}</div>
              {h.thoughts.map((t) => (
                <div key={t.review_id ?? t.url} className="text-sm text-muted-foreground pl-6 italic">{t.body}</div>
              ))}
            </div>
          ))}
          {ch.standaloneThoughts.map((t) => (
            <div key={t.review_id ?? t.url} className="text-sm pl-3 border-l-2 border-muted leading-relaxed">{t.body}</div>
          ))}
        </div>
      ))}
      <div ref={sentinelRef} className="h-1" />
      {(hlQuery.isFetchingNextPage || thQuery.isFetchingNextPage) && (
        <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
      )}
    </div>
  );
}

interface CollectionProps {
  doubanBound: boolean;
  wereadBound: boolean;
  flomoBound: boolean;
  dataCounts: Record<string, number>;
}

export function Collection({ doubanBound, wereadBound, flomoBound, dataCounts }: CollectionProps) {
  const [dataTab, setDataTab] = useState<DataTabKey>("books");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "1" | "2">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "done" | "reading" | "unread">("done");
  const [noteTypeFilter, setNoteTypeFilter] = useState<"highlights" | "thoughts">("highlights");
  const [sortBy, setSortBy] = useState("default");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);

  const availableTabs = useMemo((): DataTabKey[] => {
    const tabs: DataTabKey[] = [];
    if (doubanBound || wereadBound) tabs.push("books");
    if (doubanBound) tabs.push("movies");
    if (wereadBound) tabs.push("bookmarks");
    if (flomoBound) tabs.push("memos");
    return tabs;
  }, [doubanBound, wereadBound, flomoBound]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(dataTab)) {
      setDataTab(availableTabs[0]);
    }
  }, [availableTabs, dataTab]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const switchTab = useCallback((tab: DataTabKey) => {
    setDataTab(tab);
    setSearchText("");
    setDebouncedSearch("");
    setPlatformFilter("all");
    setStatusFilter("done");
    setNoteTypeFilter("highlights");
    setSortBy("default");
    setSortDir(-1);
    setDetailItem(null);
  }, []);

  // Build filter params
  const bookFilters = useMemo(() => ({
    keyword: debouncedSearch || undefined,
    sort_by: sortBy === "default" ? undefined : sortBy,
    sort_order: (sortDir === 1 ? "asc" : "desc") as "asc" | "desc",
    platform_id: platformFilter !== "all" ? Number(platformFilter) : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  }), [debouncedSearch, sortBy, sortDir, platformFilter, statusFilter]);

  const genericFilters = useMemo(() => ({
    keyword: debouncedSearch || undefined,
    sort_by: sortBy === "default" ? undefined : sortBy,
    sort_order: (sortDir === 1 ? "asc" : "desc") as "asc" | "desc",
  }), [debouncedSearch, sortBy, sortDir]);

  // Only enable the query for the active tab
  const booksQuery = useInfiniteBooks(bookFilters, dataTab === "books");
  const moviesQuery = useInfiniteMovies(genericFilters, dataTab === "movies");
  const bookmarksQuery = useInfiniteBookmarks(genericFilters, dataTab === "bookmarks" && noteTypeFilter === "highlights");
  const thoughtsQuery = useInfiniteNotes(genericFilters, dataTab === "bookmarks" && noteTypeFilter === "thoughts");
  const memosQuery = useInfiniteMemos(genericFilters, dataTab === "memos");

  // Select active query and extract common fields
  const activeQuery = dataTab === "books" ? booksQuery
    : dataTab === "movies" ? moviesQuery
    : dataTab === "bookmarks" ? (noteTypeFilter === "thoughts" ? thoughtsQuery : bookmarksQuery)
    : memosQuery;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = activeQuery;

  // Flatten pages into items (cast at render sites per tab)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = useMemo(
    () => (activeQuery.data?.pages.flatMap((p: { items: any[] }) => p.items).filter(Boolean) ?? []) as any[],
    [activeQuery.data?.pages],
  );

  const totalCount = activeQuery.data?.pages[0]?.total ?? 0;

  // IntersectionObserver for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const isGalleryTab = dataTab === "books" || dataTab === "movies" || dataTab === "memos";
  const currentSortOptions = SORT_OPTIONS[dataTab];
  const noBinding = !doubanBound && !wereadBound && !flomoBound;

  if (noBinding) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">请先绑定账号以查看同步数据。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(doubanBound || wereadBound) && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "books" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("books")}
          >
            图书{dataCounts.books ? ` (${dataCounts.books})` : ""}
          </button>
        )}
        {doubanBound && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "movies" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("movies")}
          >
            电影{dataCounts.movies ? ` (${dataCounts.movies})` : ""}
          </button>
        )}
        {wereadBound && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "bookmarks" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("bookmarks")}
          >
            读书笔记{(dataCounts.bookmarks || dataCounts.notes) ? ` (${(dataCounts.bookmarks ?? 0) + (dataCounts.notes ?? 0)})` : ""}
          </button>
        )}
        {flomoBound && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "memos" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("memos")}
          >
            flomo 笔记{dataCounts.memos ? ` (${dataCounts.memos})` : ""}
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={SEARCH_PLACEHOLDERS[dataTab]}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-8 text-sm"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
        >
          {currentSortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1)}
          disabled={sortBy === "default"}
          title={sortDir === 1 ? "升序" : "降序"}
        >
          {sortDir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        </Button>
        {dataTab === "books" && (
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as "all" | "1" | "2")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">全部平台</option>
            <option value="1">豆瓣</option>
            <option value="2">微信读书</option>
          </select>
        )}
        {dataTab === "books" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "done" | "reading" | "unread")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">全部状态</option>
            <option value="done">已读完</option>
            <option value="reading">在读</option>
            <option value="unread">未读</option>
          </select>
        )}
        {dataTab === "bookmarks" && (
          <select
            value={noteTypeFilter}
            onChange={(e) => setNoteTypeFilter(e.target.value as "highlights" | "thoughts")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="highlights">划线</option>
            <option value="thoughts">想法</option>
          </select>
        )}
      </div>

      {/* Gallery / List */}
      {isGalleryTab ? (
        <div className={`grid gap-2 ${dataTab === "memos" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"}`}>
          {dataTab === "books" && items.map((item) => {
            const b = item as BookItem;
            const isWeread = b.platform_id === 2;
            return (
              <div
                key={isWeread ? (b.book_id ?? b.url) : b.url}
                className="cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
                onClick={() => setDetailItem({ type: "book", data: b })}
              >
                <div className="aspect-[3/4] bg-muted relative">
                  {b.cover ? (
                    <img src={b.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-2 text-center">{b.title}</div>
                  )}
                  <img src={isWeread ? "/weread.webp" : "/douban.svg"} alt="" className="absolute bottom-1 right-1 h-3 w-3" />
                </div>
                <div className="p-1.5">
                  <div className="text-xs font-medium text-foreground truncate">{b.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {b.author || ""}{b.author && b.rating ? " / " : ""}{b.rating ? "★".repeat(Math.min(b.rating, 5)) : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {dataTab === "movies" && items.map((item) => {
            const m = item as MovieItem;
            return (
              <div
                key={m.url}
                className="cursor-pointer rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-colors"
                onClick={() => setDetailItem({ type: "movie", data: m })}
              >
                <div className="aspect-[3/4] bg-muted relative">
                  {m.cover ? (
                    <img src={m.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-2 text-center">{m.title}</div>
                  )}
                </div>
                <div className="p-1.5">
                  <div className="text-xs font-medium text-foreground truncate">{m.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {m.release_date ? m.release_date.slice(0, 4) : ""}{m.release_date && m.rating ? " / " : ""}{m.rating ? "★".repeat(m.rating) : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {dataTab === "memos" && items.map((item, i) => {
            const m = item as MemoItem;
            return (
              <div
                key={`${m.memo_created_at}-${i}`}
                className="cursor-pointer rounded-lg border border-border hover:border-primary/50 transition-colors p-3"
                onClick={() => setDetailItem({ type: "memo", data: m })}
              >
                <div className="text-sm text-foreground line-clamp-3">{stripHtml(m.content)}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {m.memo_created_at.length >= 10 ? m.memo_created_at.slice(0, 10) : m.memo_created_at}
                  </span>
                  {m.tags.length > 0 && (
                    <div className="flex gap-1">
                      {m.tags.slice(0, 2).map((t) => (
                        <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {dataTab === "bookmarks" && noteTypeFilter === "highlights" && items.map((item, i) => {
            const bm = item as BookmarkItem;
            return (
              <div key={bm.bookmark_id ?? `${bm.book_id}-${i}`} className="p-3 rounded-lg space-y-1">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground">{bm.chapter_name ?? `第${bm.chapter_idx}章`}</span>
                  <span className="text-xs text-muted-foreground">{bm.book_title}</span>
                </div>
                <span className="text-sm text-foreground leading-relaxed">{bm.mark_text}</span>
              </div>
            );
          })}
          {dataTab === "bookmarks" && noteTypeFilter === "thoughts" && items.map((item, i) => {
            const n = item as NoteItem;
            const parts = (n.title ?? "").split(" - ");
            const bookTitle = parts.length > 1 ? parts.slice(0, -1).join(" - ") : parts[0];
            const chapter = n.location || (parts.length > 1 ? parts[parts.length - 1] : "");
            const dateStr = n.date && /^\d{8,}$/.test(n.date)
              ? new Date(Number(n.date) * 1000).toISOString().slice(0, 10)
              : n.date ?? "";
            return (
              <div key={`thought-${i}`} className="p-3 rounded-lg space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{bookTitle}</span>
                  <span>{dateStr}</span>
                </div>
                {chapter && <span className="text-xs text-muted-foreground">{chapter}</span>}
                {n.abstract && <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 italic">{n.abstract}</p>}
                {n.body && <p className="text-sm text-foreground leading-relaxed">{n.body}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel & loading */}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {totalCount === 0 && !activeQuery.isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {debouncedSearch ? "没有匹配的搜索结果。" : `暂无${dataTab === "books" ? "图书" : dataTab === "movies" ? "影视" : dataTab === "bookmarks" ? "笔记" : "flomo 笔记"}数据。`}
        </p>
      )}

      {/* Total count */}
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">共 {totalCount} 项</p>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className={`max-h-[80vh] overflow-hidden p-0 gap-0 ${detailItem?.type === "book" && detailItem.data.platform_id === 2 ? "max-w-2xl" : "max-w-lg"}`}>
          <VisuallyHidden>
            <DialogTitle>
              {detailItem?.type === "book" ? "图书详情" : detailItem?.type === "movie" ? "电影详情" : "笔记详情"}
            </DialogTitle>
          </VisuallyHidden>
          {detailItem?.type === "book" && (
            <div className="flex flex-col h-[80vh]">
              <div className="shrink-0 space-y-4 p-6 pb-2">
                <div className="flex gap-4">
                  {detailItem.data.cover ? (
                    <img src={detailItem.data.cover} alt="" className="w-24 h-32 object-cover rounded" />
                  ) : (
                    <div className="w-24 h-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">无封面</div>
                  )}
                  <div className="space-y-1 text-sm flex-1">
                    <div className="font-semibold text-foreground">{detailItem.data.title}</div>
                    {detailItem.data.rating && <div className="text-primary">{"★".repeat(Math.min(detailItem.data.rating, 5))}{"☆".repeat(5 - Math.min(detailItem.data.rating, 5))}</div>}
                    {detailItem.data.author && <div className="text-muted-foreground">作者: {detailItem.data.author}</div>}
                    {detailItem.data.publisher && <div className="text-muted-foreground">出版社: {detailItem.data.publisher}</div>}
                    {detailItem.data.pub_date && <div className="text-muted-foreground">出版日期: {detailItem.data.pub_date}</div>}
                    {detailItem.data.read_date && <div className="text-muted-foreground">阅读日期: {detailItem.data.read_date}</div>}
                  </div>
                </div>
                {detailItem.data.tags && detailItem.data.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{detailItem.data.tags.map((t) => <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}</div>
                )}
                {detailItem.data.comment && <div className="text-sm text-muted-foreground"><div className="font-medium text-foreground mb-1">评论</div>{detailItem.data.comment}</div>}
              </div>
              {detailItem.data.platform_id === 2 && detailItem.data.book_id ? (
                <ScrollArea className="flex-1 min-h-0 px-6 pb-6">
                  <WereadBookAnnotations bookId={detailItem.data.book_id} />
                </ScrollArea>
              ) : (
                <div className="flex-1 min-h-0 px-6 pb-6" />
              )}
            </div>
          )}
          {detailItem?.type === "movie" && (
            <ScrollArea className="h-[80vh]">
              <div className="space-y-4 p-6">
                <div className="flex gap-4">
                  {detailItem.data.cover ? (
                    <img src={detailItem.data.cover} alt="" className="w-24 h-32 object-cover rounded" />
                  ) : (
                    <div className="w-24 h-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">无封面</div>
                  )}
                  <div className="space-y-1 text-sm flex-1">
                    <div className="font-semibold text-foreground">{detailItem.data.title}</div>
                    {detailItem.data.rating && <div className="text-primary">{"★".repeat(Math.min(detailItem.data.rating, 5))}{"☆".repeat(5 - Math.min(detailItem.data.rating, 5))}</div>}
                    {detailItem.data.release_date && <div className="text-muted-foreground">上映日期: {detailItem.data.release_date}</div>}
                    {detailItem.data.watch_date && <div className="text-muted-foreground">观影日期: {detailItem.data.watch_date}</div>}
                  </div>
                </div>
                {detailItem.data.tags && detailItem.data.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{detailItem.data.tags.map((t) => <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}</div>
                )}
                {detailItem.data.comment && <div className="text-sm text-muted-foreground"><div className="font-medium text-foreground mb-1">评论</div>{detailItem.data.comment}</div>}
              </div>
            </ScrollArea>
          )}
          {detailItem?.type === "memo" && (
            <ScrollArea className="h-[80vh]">
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{detailItem.data.memo_created_at}</span>
                </div>
                <div className="text-sm text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: detailItem.data.content }} />
                {detailItem.data.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{detailItem.data.tags.map((t) => <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}</div>
                )}
                {detailItem.data.files.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {detailItem.data.files.map((f, i) => <img key={i} src={f} alt="" className="w-full rounded" loading="lazy" />)}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
