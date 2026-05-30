import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { checkAllBindings, getPaginatedCommunityData, startBinding, unbind as unbindApi, syncData, refreshProfile } from "./api";
import type { BookItem, MovieItem, NoteItem, BookmarkItem, MemoItem, BookFilterParams, PaginationParams } from "./types";

const PAGE_SIZE = 20;

export function useAllBindings() {
  return useQuery({
    queryKey: ["bindings"],
    queryFn: checkAllBindings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStartBinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => startBinding(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bindings"] }),
  });
}

export function useUnbind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => unbindApi(platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bindings"] });
      qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
    },
  });
}

export function useSyncData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => syncData(platform),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communityData", "infinite"] });
    },
  });
}

export function useRefreshProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (platform: string) => refreshProfile(platform),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bindings"] }),
  });
}

// ---- Infinite query hooks ----

export function useInfiniteBooks(filters: Omit<BookFilterParams, "page" | "page_size">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "infinite", "books", filters],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<BookItem>("books", {
        page: pageParam,
        page_size: PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useInfiniteMovies(filters: Omit<PaginationParams, "page" | "page_size">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "infinite", "movies", filters],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<MovieItem>("movies", {
        page: pageParam,
        page_size: PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useInfiniteNotes(filters: Omit<PaginationParams, "page" | "page_size">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "infinite", "notes", filters],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<NoteItem>("notes", {
        page: pageParam,
        page_size: PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useInfiniteBookmarks(filters: Omit<PaginationParams, "page" | "page_size">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "infinite", "bookmarks", filters],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<BookmarkItem>("bookmarks", {
        page: pageParam,
        page_size: PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

export function useInfiniteMemos(filters: Omit<PaginationParams, "page" | "page_size">, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "infinite", "memos", filters],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<MemoItem>("memos", {
        page: pageParam,
        page_size: PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}

// ---- Book-scoped infinite queries (for detail modal) ----

const DETAIL_PAGE_SIZE = 50;

export function useBookHighlights(bookId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "book-detail", "highlights", bookId],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<BookmarkItem>("bookmarks", {
        page: pageParam,
        page_size: DETAIL_PAGE_SIZE,
        book_id: bookId,
      } as PaginationParams & { book_id: string }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !!bookId,
  });
}

export function useBookThoughts(bookId: string | undefined, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["communityData", "book-detail", "thoughts", bookId],
    queryFn: ({ pageParam }) =>
      getPaginatedCommunityData<NoteItem>("notes", {
        page: pageParam,
        page_size: DETAIL_PAGE_SIZE,
        book_id: bookId,
      } as PaginationParams & { book_id: string }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: enabled && !!bookId,
  });
}
