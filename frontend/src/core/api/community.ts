import { apiFetch } from "./client";
import { env } from "../../env";
import type { BindStatus, PollResult, CommunityData } from "../community/types";

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

export async function getAllCommunityData(): Promise<Record<string, CommunityData>> {
  const res = await apiFetch("/api/community/data?platform=all");
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
  const wsUrl = env.NEXT_PUBLIC_BACKEND_WS_URL || "ws://localhost:8000";
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
