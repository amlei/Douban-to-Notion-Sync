import { useState, useEffect, useRef, useCallback } from "react";
import { usePlatformBinding, setCommunityData } from "./usePlatformBinding";
import { getAllCommunityData, checkAllBindings } from "../../../api/community";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem, CommunityData } from "../../../types/community";

export interface CommunityDataState {
  books: BookItem[];
  wereadBooks: BookItem[];
  movies: MovieItem[];
  notes: NoteItem[];
  wereadBookmarks: BookmarkItem[];
  flomoMemos: MemoItem[];
  qrSrc: string | null;
  bindError: string | null;
  activePlatform: string;
  doubanBinding: ReturnType<typeof usePlatformBinding>;
  wereadBinding: ReturnType<typeof usePlatformBinding>;
  flomoBinding: ReturnType<typeof usePlatformBinding>;
  setActivePlatform: (p: string) => void;
}

export function useCommunityData(): CommunityDataState {
  const wsRef = useRef<WebSocket | null>(null);
  const [activePlatform, setActivePlatform] = useState("douban");
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [bindError, setBindError] = useState<string | null>(null);

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

  useEffect(() => {
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
  }, []);

  useEffect(() => () => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
  }, []);

  return {
    books, wereadBooks, movies, notes, wereadBookmarks, flomoMemos,
    qrSrc, bindError, activePlatform,
    doubanBinding, wereadBinding, flomoBinding,
    setActivePlatform,
  };
}
