import { useState } from "react";
import "./DataTab.css";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem } from "../../types/community";

interface DataTabProps {
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

export function DataTab({ doubanBound, wereadBound, flomoBound, books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos }: DataTabProps) {
  const [dataTab, setDataTab] = useState<"books" | "movies" | "notes" | "bookmarks" | "memos">("books");

  if (!doubanBound && !wereadBound && !flomoBound) {
    return (
      <div className="settings-page">
        <h3>数据管理</h3>
        <p className="settings-desc">请先绑定账号以查看同步数据。</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <h3>数据管理</h3>
      <div className="data-tabs">
        {(doubanBound || wereadBound) && (
          <button
            className={`data-tab ${dataTab === "books" ? "active" : ""}`}
            onClick={() => setDataTab("books")}
          >
            图书 ({books.length + wereadBooks.length})
          </button>
        )}
        {doubanBound && (
          <>
            <button
              className={`data-tab ${dataTab === "movies" ? "active" : ""}`}
              onClick={() => setDataTab("movies")}
            >
              电影 ({movies.length})
            </button>
            <button
              className={`data-tab ${dataTab === "notes" ? "active" : ""}`}
              onClick={() => setDataTab("notes")}
            >
              日记 ({notes.length})
            </button>
          </>
        )}
        {wereadBound && (
          <button
            className={`data-tab ${dataTab === "bookmarks" ? "active" : ""}`}
            onClick={() => setDataTab("bookmarks")}
          >
            读书笔记 ({wereadBookmarks.length})
          </button>
        )}
        {flomoBound && (
          <button
            className={`data-tab ${dataTab === "memos" ? "active" : ""}`}
            onClick={() => setDataTab("memos")}
          >
            flomo 笔记 ({flomoMemos.length})
          </button>
        )}
      </div>
      <div className="data-list">
        {dataTab === "books" && [...books, ...wereadBooks].map((b) => {
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
        {dataTab === "movies" && movies.map((m) => (
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
        ))}
        {dataTab === "notes" && notes.map((n, i) => (
          n.url ? (
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
            <div key={i} className="data-item">
              <div className="data-item-info">
                <span className="data-item-title">{n.title}</span>
                <span className="data-item-meta">
                  {n.date && n.date}
                  {n.location && ` / ${n.location}`}
                </span>
              </div>
            </div>
          )
        ))}
        {dataTab === "bookmarks" && wereadBookmarks.map((bm, i) => (
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
        ))}
        {dataTab === "memos" && flomoMemos.map((m, i) => (
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
        ))}
        {dataTab === "books" && books.length === 0 && wereadBooks.length === 0 && (
          <p className="settings-desc">暂无图书数据，点击"同步数据"开始导入。</p>
        )}
        {dataTab === "movies" && movies.length === 0 && (
          <p className="settings-desc">暂无影视数据，点击"同步数据"开始导入。</p>
        )}
        {dataTab === "notes" && notes.length === 0 && (
          <p className="settings-desc">暂无日记数据，点击"同步数据"开始导入。</p>
        )}
        {dataTab === "bookmarks" && wereadBookmarks.length === 0 && (
          <p className="settings-desc">暂无笔记数据，点击"同步数据"开始导入。</p>
        )}
        {dataTab === "memos" && flomoMemos.length === 0 && (
          <p className="settings-desc">暂无 flomo 笔记数据，点击"同步数据"开始导入。</p>
        )}
      </div>
    </div>
  );
}
