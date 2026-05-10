"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "@/core/community/types";

type DataTabKey = "books" | "movies" | "notes" | "bookmarks" | "memos";

type DetailItem =
  | { type: "book"; data: BookItem }
  | { type: "movie"; data: MovieItem }
  | { type: "memo"; data: MemoItem };

const SEARCH_PLACEHOLDERS: Record<DataTabKey, string> = {
  books: "搜索图书...",
  movies: "搜索电影...",
  notes: "搜索日记...",
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
  notes: [
    { value: "default", label: "默认排序" },
    { value: "title", label: "按标题" },
    { value: "date", label: "按日期" },
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

function compare(a: string | number | null | undefined, b: string | number | null | undefined, dir: number): number {
  if (a == null && b == null) return 0;
  if (a == null) return dir;
  if (b == null) return -dir;
  const va = typeof a === "string" ? a.toLowerCase() : a;
  const vb = typeof b === "string" ? b.toLowerCase() : b;
  if (va < vb) return -dir;
  if (va > vb) return dir;
  return 0;
}

interface CollectionProps {
  doubanBound: boolean;
  wereadBound: boolean;
  flomoBound: boolean;
  books: BookItem[];
  wereadBooks: BookItem[];
  movies: MovieItem[];
  notes: NoteItem[];
  wereadBookmarks: BookmarkItem[];
  flomoMemos: MemoItem[];
}

export function Collection({ doubanBound, wereadBound, flomoBound, books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos }: CollectionProps) {
  const [dataTab, setDataTab] = useState<DataTabKey>("books");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "1" | "2">("all");
  const [sortBy, setSortBy] = useState("default");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(1);
  const [detailItem, setDetailItem] = useState<DetailItem | null>(null);

  const availableTabs = useMemo((): DataTabKey[] => {
    const tabs: DataTabKey[] = [];
    if (doubanBound || wereadBound) tabs.push("books");
    if (doubanBound) tabs.push("movies", "notes");
    if (wereadBound) tabs.push("bookmarks");
    if (flomoBound) tabs.push("memos");
    return tabs;
  }, [doubanBound, wereadBound, flomoBound]);

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(dataTab)) {
      setDataTab(availableTabs[0]);
    }
  }, [availableTabs, dataTab]);

  const isGalleryTab = dataTab === "books" || dataTab === "movies" || dataTab === "memos";
  const pageSize = isGalleryTab ? 30 : 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => { setPage(1); }, [dataTab, debouncedSearch, platformFilter, sortBy, sortDir]);

  const switchTab = useCallback((tab: DataTabKey) => {
    setDataTab(tab);
    setSearchText("");
    setPlatformFilter("all");
    setSortBy("default");
    setSortDir(-1);
    setDetailItem(null);
  }, []);

  const noBinding = !doubanBound && !wereadBound && !flomoBound;

  const allItems = (() => {
    switch (dataTab) {
      case "books": return [...books, ...wereadBooks];
      case "movies": return movies;
      case "notes": return notes;
      case "bookmarks": return wereadBookmarks;
      case "memos": return flomoMemos;
    }
  })();

  const afterPlatformFilter = dataTab === "books" && platformFilter !== "all"
    ? (allItems as BookItem[]).filter((b) => String(b.platform_id) === platformFilter)
    : allItems;

  const query = debouncedSearch.toLowerCase();
  const filtered = query
    ? afterPlatformFilter.filter((item) => {
        switch (dataTab) {
          case "books": {
            const b = item as BookItem;
            return [b.title, b.author, b.publisher].some((f) => f?.toLowerCase().includes(query));
          }
          case "movies":
            return (item as MovieItem).title.toLowerCase().includes(query);
          case "notes":
            return (item as NoteItem).title.toLowerCase().includes(query);
          case "bookmarks": {
            const bm = item as BookmarkItem;
            return bm.mark_text.toLowerCase().includes(query) || bm.book_title?.toLowerCase().includes(query);
          }
          case "memos":
            return stripHtml((item as MemoItem).content).toLowerCase().includes(query);
        }
      })
    : afterPlatformFilter;

  const sorted = useMemo(() => {
    const d = sortDir;
    if (sortBy === "default") {
      if (dataTab === "memos") {
        return [...filtered].sort((a, b) =>
          compare((a as MemoItem).memo_created_at, (b as MemoItem).memo_created_at, -1)
        );
      }
      return filtered;
    }
    return [...filtered].sort((a, b) => {
      switch (dataTab) {
        case "books": {
          const ba = a as BookItem, bb = b as BookItem;
          if (sortBy === "title") return compare(ba.title, bb.title, d);
          if (sortBy === "rating") return compare(ba.rating, bb.rating, d);
          if (sortBy === "read_date") return compare(ba.read_date, bb.read_date, d);
          return 0;
        }
        case "movies": {
          const ma = a as MovieItem, mb = b as MovieItem;
          if (sortBy === "title") return compare(ma.title, mb.title, d);
          if (sortBy === "rating") return compare(ma.rating, mb.rating, d);
          if (sortBy === "watch_date") return compare(ma.watch_date, mb.watch_date, d);
          return 0;
        }
        case "notes": {
          const na = a as NoteItem, nb = b as NoteItem;
          if (sortBy === "title") return compare(na.title, nb.title, d);
          if (sortBy === "date") return compare(na.date, nb.date, d);
          return 0;
        }
        case "bookmarks": {
          const bma = a as BookmarkItem, bmb = b as BookmarkItem;
          if (sortBy === "book_title") return compare(bma.book_title, bmb.book_title, d);
          if (sortBy === "create_time") return compare(bma.create_time, bmb.create_time, d);
          return 0;
        }
        case "memos": {
          const fma = a as MemoItem, fmb = b as MemoItem;
          if (sortBy === "created_at") return compare(fma.memo_created_at, fmb.memo_created_at, d);
          return 0;
        }
      }
    });
  }, [filtered, sortBy, sortDir, dataTab]);

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    const start = Math.max(1, safePage - 1);
    const end = Math.min(totalPages, safePage + 1);
    if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push("..."); pages.push(totalPages); }
    return pages;
  }, [safePage, totalPages]);

  const currentSortOptions = SORT_OPTIONS[dataTab];

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
            图书 ({books.length + wereadBooks.length})
          </button>
        )}
        {doubanBound && (
          <>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "movies" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => switchTab("movies")}
            >
              电影 ({movies.length})
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "notes" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => switchTab("notes")}
            >
              日记 ({notes.length})
            </button>
          </>
        )}
        {wereadBound && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "bookmarks" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("bookmarks")}
          >
            读书笔记 ({wereadBookmarks.length})
          </button>
        )}
        {flomoBound && (
          <button
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${dataTab === "memos" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => switchTab("memos")}
          >
            flomo 笔记 ({flomoMemos.length})
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
      </div>

      {/* Gallery / List */}
      {isGalleryTab ? (
        <div className={`grid gap-2 ${dataTab === "memos" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8"}`}>
          {dataTab === "books" && paged.map((item) => {
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
                    {b.author || ""}{b.author && b.rating ? " / " : ""}{b.rating ? "★".repeat(b.rating) : ""}
                  </div>
                </div>
              </div>
            );
          })}
          {dataTab === "movies" && paged.map((item) => {
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
          {dataTab === "memos" && paged.map((item, i) => {
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
          {dataTab === "notes" && paged.map((item, i) => {
            const n = item as NoteItem;
            return n.url ? (
              <a key={n.url} href={n.url} target="_blank" rel="noreferrer" className="block p-3 rounded-lg hover:bg-accent transition-colors">
                <div className="text-sm font-medium text-foreground">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.date}{n.location ? ` / ${n.location}` : ""}</div>
              </a>
            ) : (
              <div key={`note-${i}`} className="p-3 rounded-lg">
                <div className="text-sm font-medium text-foreground">{n.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{n.date}{n.location ? ` / ${n.location}` : ""}</div>
              </div>
            );
          })}
          {dataTab === "bookmarks" && paged.map((item, i) => {
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
        </div>
      )}

      {totalCount === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {debouncedSearch ? "没有匹配的搜索结果。" : `暂无${dataTab === "books" ? "图书" : dataTab === "movies" ? "影视" : dataTab === "notes" ? "日记" : dataTab === "bookmarks" ? "笔记" : "flomo 笔记"}数据。`}
        </p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
            <ChevronLeft size={14} />
          </Button>
          {pageNumbers.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground">...</span>
            ) : (
              <Button key={p} variant={p === safePage ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setPage(p)}>
                {p}
              </Button>
            )
          )}
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>
            <ChevronRight size={14} />
          </Button>
          <span className="text-xs text-muted-foreground ml-2">共 {totalCount} 项</span>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <VisuallyHidden>
            <DialogTitle>
              {detailItem?.type === "book" ? "图书详情" : detailItem?.type === "movie" ? "电影详情" : "笔记详情"}
            </DialogTitle>
          </VisuallyHidden>
          {detailItem?.type === "book" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {detailItem.data.cover ? (
                  <img src={detailItem.data.cover} alt="" className="w-24 h-32 object-cover rounded" />
                ) : (
                  <div className="w-24 h-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">无封面</div>
                )}
                <div className="space-y-1 text-sm flex-1">
                  <div className="font-semibold text-foreground">{detailItem.data.title}</div>
                  {detailItem.data.rating && <div className="text-primary">{"★".repeat(detailItem.data.rating)}{"☆".repeat(5 - detailItem.data.rating)}</div>}
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
          )}
          {detailItem?.type === "movie" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                {detailItem.data.cover ? (
                  <img src={detailItem.data.cover} alt="" className="w-24 h-32 object-cover rounded" />
                ) : (
                  <div className="w-24 h-32 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">无封面</div>
                )}
                <div className="space-y-1 text-sm flex-1">
                  <div className="font-semibold text-foreground">{detailItem.data.title}</div>
                  {detailItem.data.rating && <div className="text-primary">{"★".repeat(detailItem.data.rating)}{"☆".repeat(5 - detailItem.data.rating)}</div>}
                  {detailItem.data.release_date && <div className="text-muted-foreground">上映日期: {detailItem.data.release_date}</div>}
                  {detailItem.data.watch_date && <div className="text-muted-foreground">观影日期: {detailItem.data.watch_date}</div>}
                </div>
              </div>
              {detailItem.data.tags && detailItem.data.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">{detailItem.data.tags.map((t) => <span key={t} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{t}</span>)}</div>
              )}
              {detailItem.data.comment && <div className="text-sm text-muted-foreground"><div className="font-medium text-foreground mb-1">评论</div>{detailItem.data.comment}</div>}
            </div>
          )}
          {detailItem?.type === "memo" && (
            <div className="space-y-4">
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
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
