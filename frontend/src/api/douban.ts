import type { BindStatus, PollResult, CommunityData } from "../types/community";
import { authedFetch, getAuth } from "./auth";

export type { BindStatus, PollResult, CommunityData };
export type { PlatformProfile, BookItem, MovieItem, NoteItem, BookmarkItem } from "../types/community";

async function bindAction(
  action: "status" | "start" | "refresh" | "delete",
  platform: string,
): Promise<Response> {
  return authedFetch(`/api/community/bind?action=${action}&platform=${platform}`, {
    method: "POST",
  });
}

export async function checkAllBindings(): Promise<Record<string, BindStatus>> {
  const res = await bindAction("status", "all");
  return res.json();
}

export async function startBinding(platform: string): Promise<{ task_id: string }> {
  const res = await bindAction("start", platform);
  return res.json();
}

export async function unbind(platform: string): Promise<{ bound: boolean }> {
  const res = await bindAction("delete", platform);
  return res.json();
}

export async function refreshProfile(platform: string): Promise<BindStatus> {
  const res = await bindAction("refresh", platform);
  return res.json();
}

export async function syncData(platform: string): Promise<{ task_id: string }> {
  const res = await authedFetch(`/api/community/sync?platform=${platform}`, { method: "POST" });
  return res.json();
}

export async function getAllCommunityData(): Promise<Record<string, CommunityData>> {
  const res = await authedFetch("/api/community/data?platform=all");
  return res.json();
}

export interface BindWsCallbacks {
  onQr: (base64: string) => void;
  onStatus: (status: PollResult["status"]) => void;
  onScraping: (phase: PollResult["scrape_phase"], counts: Record<string, number>) => void;
  onBound: (user_id: string, profile: PollResult["profile"] | undefined, counts: Record<string, number>) => void;
  onFailed: (error: string) => void;
}

export function connectBindWs(platform: string, cb: BindWsCallbacks): WebSocket {
  const token = getAuth()?.access_token ?? "";
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${proto}//${location.host}/api/community/ws?platform=${platform}`, token);

  ws.onmessage = (e) => {
    const data: PollResult = JSON.parse(e.data);
    cb.onStatus(data.status);
    if (data.status === "pending" && data.qr_base64) cb.onQr(data.qr_base64);
    if (data.status === "scraping") cb.onScraping(data.scrape_phase ?? "books", data.scrape_counts ?? {});
    if (data.status === "bound") cb.onBound(data.user_id!, data.profile ?? undefined, data.scrape_counts ?? {});
    if (data.status === "failed") cb.onFailed(data.error ?? "绑定失败");
  };

  ws.onclose = (e) => {
    if (e.code !== 1000) {
      cb.onStatus("idle");
    }
  };

  return ws;
}
