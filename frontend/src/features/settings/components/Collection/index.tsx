import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import "./Collection.css";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "../../../../types/community";

const PAGE_SIZE = 10;

type DataTabKey = "books" | "movies" | "notes" | "bookmarks" | "memos";

const SEARCH_PLACEHOLDERS: Record<DataTabKey, string> = {
  books: "搜索图书...",
  movies: "搜索电影...",
  notes: "搜索日记...",
  bookmarks: "搜索读书笔记...",
  memos: "搜索 flomo 笔记...",
};

interface SortOption {
  value: string;
  label: string;
}

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
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

const EMPTY_HINTS: Record<DataTabKey, string> = {
  books: "暂无图书数据，点击\u201C同步数据\u201D开始导入。",
  movies: "暂无影视数据，点击\u201C同步数据\u201D开始导入。",
  notes: "暂无日记数据，点击\u201C同步数据\u201D开始导入。",
  bookmarks: "暂无笔记数据，点击\u201C同步数据\u201D开始导入。",
  memos: "暂无 flomo 笔记数据，点击\u201C同步数据\u201D开始导入。",
};

function emptyHint(tab: DataTabKey): string {
  return EMPTY_HINTS[tab];
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

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    setPage(1);
  }, [dataTab, debouncedSearch, platformFilter, sortBy, sortDir]);

  const switchTab = useCallback((tab: DataTabKey) => {
    setDataTab(tab);
    setSearchText("");
    setPlatformFilter("all");
    setSortBy("default");
    setSortDir(-1);
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
    if (sortBy === "default") return filtered;
    const d = sortDir;
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
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [];
    const start = Math.max(1, safePage - 1);
    const end = Math.min(totalPages, safePage + 1);
    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  const currentSortOptions = SORT_OPTIONS[dataTab];

  if (noBinding) {
    return (
      <div className="panel-modal-page">
        <p className="panel-modal-desc">请先绑定账号以查看同步数据。</p>
      </div>
    );
  }

  return (
    <div className="panel-modal-page">
      <div className="data-tabs">
        {(doubanBound || wereadBound) && (
          <button
            className={`data-tab ${dataTab === "books" ? "active" : ""}`}
            onClick={() => switchTab("books")}
          >
            图书 ({books.length + wereadBooks.length})
          </button>
        )}
        {doubanBound && (
          <>
            <button
              className={`data-tab ${dataTab === "movies" ? "active" : ""}`}
              onClick={() => switchTab("movies")}
            >
              电影 ({movies.length})
            </button>
            <button
              className={`data-tab ${dataTab === "notes" ? "active" : ""}`}
              onClick={() => switchTab("notes")}
            >
              日记 ({notes.length})
            </button>
          </>
        )}
        {wereadBound && (
          <button
            className={`data-tab ${dataTab === "bookmarks" ? "active" : ""}`}
            onClick={() => switchTab("bookmarks")}
          >
            读书笔记 ({wereadBookmarks.length})
          </button>
        )}
        {flomoBound && (
          <button
            className={`data-tab ${dataTab === "memos" ? "active" : ""}`}
            onClick={() => switchTab("memos")}
          >
            flomo 笔记 ({flomoMemos.length})
          </button>
        )}
      </div>

      <div className="data-toolbar">
        <div className="data-search">
          <Search size={14} />
          <input
            type="text"
            placeholder={SEARCH_PLACEHOLDERS[dataTab]}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <select
          className="data-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          {currentSortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          className={`data-sort-dir ${sortBy !== "default" ? "" : "disabled"}`}
          onClick={() => setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1)}
          disabled={sortBy === "default"}
          title={sortDir === 1 ? "升序" : "降序"}
        >
          {sortDir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        </button>
        {dataTab === "books" && (
          <select
            className="data-platform-filter"
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as "all" | "1" | "2")}
          >
            <option value="all">全部平台</option>
            <option value="1">豆瓣</option>
            <option value="2">微信读书</option>
          </select>
        )}
      </div>

      <div className="data-list">
        {dataTab === "books" && paged.map((item) => {
          const b = item as BookItem;
          const isWeread = b.platform_id === 2;
          const bookKey = isWeread ? (b.book_id ?? b.url) : b.url;
          const href = isWeread ? undefined : b.url;
          const Wrapper = href ? "a" : "div";
          return (
            <Wrapper
              key={bookKey}
              {...(href ? { href, target: "_blank", rel: "noreferrer" } : {})}
              className="data-item"
            >
              {b.cover && <img src={b.cover} alt="" className="data-item-cover" />}
              <div className="data-item-info">
                <span className="data-item-title">
                  {b.title}
                  <img
                    src={isWeread ? "/weread.webp" : "/douban.svg"}
                    alt=""
                    style={{ height: 14, marginLeft: 6, verticalAlign: "middle", opacity: 0.7 }}
                  />
                </span>
                <span className="data-item-meta">
                  {b.author && `${b.author}`}
                  {b.author && b.publisher && " / "}
                  {b.publisher && `${b.publisher}`}
                  {b.rating_detail && ` / ${b.rating_detail}`}
                  {!isWeread && !b.rating_detail && b.rating && ` / ${"★".repeat(b.rating)}`}
                </span>
                {isWeread && (
                  <span className="data-item-meta">
                    {b.total_words && `${(b.total_words / 10000).toFixed(1)}万字`}
                    {b.total_words && b.isbn && " / "}
                    {b.isbn && `ISBN ${b.isbn}`}
                    {b.status === "1" && " / 已读完"}
                  </span>
                )}
                {!isWeread && b.tags && b.tags.length > 0 && (
                  <div className="data-item-tags">
                    {b.tags.map((t) => <span key={t} className="data-tag">{t}</span>)}
                  </div>
                )}
              </div>
            </Wrapper>
          );
        })}
        {dataTab === "movies" && paged.map((item) => {
          const m = item as MovieItem;
          return (
            <a key={m.url} href={m.url} target="_blank" rel="noreferrer" className="data-item">
              {m.cover && <img src={m.cover} alt="" className="data-item-cover" />}
              <div className="data-item-info">
                <span className="data-item-title">{m.title}</span>
                <span className="data-item-meta">
                  {m.release_date && `${m.release_date}`}
                  {m.rating && ` / ${"★".repeat(m.rating)}`}
                </span>
                {m.tags && m.tags.length > 0 && (
                  <div className="data-item-tags">
                    {m.tags.map((t) => <span key={t} className="data-tag">{t}</span>)}
                  </div>
                )}
              </div>
            </a>
          );
        })}
        {dataTab === "notes" && paged.map((item, i) => {
          const n = item as NoteItem;
          return n.url ? (
            <a key={n.url} href={n.url} target="_blank" rel="noreferrer" className="data-item">
              <div className="data-item-info">
                <span className="data-item-title">{n.title}</span>
                <span className="data-item-meta">
                  {n.date && n.date}
                  {n.location && ` / ${n.location}`}
                </span>
              </div>
            </a>
          ) : (
            <div key={`note-${i}`} className="data-item">
              <div className="data-item-info">
                <span className="data-item-title">{n.title}</span>
                <span className="data-item-meta">
                  {n.date && n.date}
                  {n.location && ` / ${n.location}`}
                </span>
              </div>
            </div>
          );
        })}
        {dataTab === "bookmarks" && paged.map((item, i) => {
          const bm = item as BookmarkItem;
          return (
            <div key={bm.bookmark_id ?? `${bm.book_id}-${i}`} className="data-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                <span className="data-item-title" style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>
                  {bm.chapter_name ?? `第${bm.chapter_idx}章`}
                </span>
                <span className="data-item-meta">
                  {bm.book_title}
                </span>
              </div>
              <span style={{ fontSize: "0.85rem", lineHeight: 1.5, color: "var(--text)" }}>
                {bm.mark_text}
              </span>
            </div>
          );
        })}
        {dataTab === "memos" && paged.map((item, i) => {
          const m = item as MemoItem;
          return (
            <div key={`${m.memo_created_at}-${i}`} className="data-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                <span className="data-item-meta">
                  {m.memo_created_at}
                </span>
                <img
                  src="/flomoapp.svg"
                  alt=""
                  style={{ height: 14, verticalAlign: "middle", opacity: 0.7 }}
                />
              </div>
              <div
                style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text)" }}
                dangerouslySetInnerHTML={{ __html: m.content }}
              />
              {m.tags.length > 0 && (
                <div className="data-item-tags">
                  {m.tags.map((t) => <span key={t} className="data-tag">{t}</span>)}
                </div>
              )}
            </div>
          );
        })}

        {totalCount === 0 && (
          <p className="panel-modal-desc">
            {debouncedSearch
              ? "没有匹配的搜索结果。"
              : emptyHint(dataTab)}
          </p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="data-pagination">
          <button
            className="page-btn"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          {pageNumbers.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="page-ellipsis">...</span>
            ) : (
              <button
                key={p}
                className={`page-btn ${p === safePage ? "active" : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="page-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight size={14} />
          </button>
          <span className="page-info">共 {totalCount} 项</span>
        </div>
      )}
    </div>
  );
}
