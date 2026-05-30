import { apiFetch } from "@/core/api/client";
import type { BindStatus, PollResult, CommunityDataType, PaginatedResponse, PaginationParams } from "./types";

async function bindAction(
  action: "status" | "start" | "refresh" | "delete",
  platform: string,
): Promise<Response> {
  return apiFetch(`/api/community/bind?action=${action}&platform=${platform}`, {
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

export async function startBindingWithApiKey(
  platform: string,
  apiKey: string,
): Promise<{ task_id: string }> {
  const res = await apiFetch(
    `/api/community/bind?action=start&platform=${platform}`,
    { method: "POST", body: JSON.stringify({ api_key: apiKey }) },
  );
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
  const res = await apiFetch(`/api/community/sync?platform=${platform}`, { method: "POST" });
  return res.json();
}

export async function getPaginatedCommunityData<T>(
  type: CommunityDataType,
  params: PaginationParams,
): Promise<PaginatedResponse<T>> {
  const sp = new URLSearchParams();
  sp.set("type", type);
  sp.set("page", String(params.page));
  sp.set("page_size", String(params.page_size));
  if (params.keyword) sp.set("keyword", params.keyword);
  if (params.sort_by) sp.set("sort_by", params.sort_by);
  if (params.sort_order) sp.set("sort_order", params.sort_order);
  if ("platform_id" in params && params.platform_id != null) {
    sp.set("platform_id", String((params as Record<string, unknown>).platform_id));
  }
  if ("book_id" in params && (params as Record<string, unknown>).book_id) {
    sp.set("book_id", String((params as Record<string, unknown>).book_id));
  }
  if ("status" in params && (params as Record<string, unknown>).status) {
    sp.set("status", String((params as Record<string, unknown>).status));
  }
  const res = await apiFetch(`/api/community/data?${sp}`);
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
  // Connect directly to Go backend -- Next.js Turbopack rewrite does not proxy WebSocket.
  // Cookie is host-only on localhost, so browser sends it to localhost:8000 automatically.
  const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000";
  const ws = new WebSocket(`${wsUrl}/api/community/ws?platform=${platform}`);

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
