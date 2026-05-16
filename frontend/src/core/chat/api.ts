import { apiFetch } from "@/core/api/client";
import type { ChatMeta } from "./types";

export interface ChatMessage {
  id: number;
  session_id: string;
  role: string;
  content: string;
  reasoning?: string;
  created_at: number;
}

interface RawSession {
  session_id: string;
  title: string;
  created_at: number;
}

export async function listSessions(): Promise<ChatMeta[]> {
  const res = await apiFetch("/api/chat?action=list", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Failed to list sessions");
  const raw: RawSession[] = await res.json();
  return raw.map((s) => ({
    id: s.session_id,
    title: s.title,
    createdAt: s.created_at,
  }));
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const res = await apiFetch(`/api/chat?action=messages&session_id=${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Failed to get messages");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await apiFetch(`/api/chat?action=delete&session_id=${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function renameSession(sessionId: string, title: string): Promise<void> {
  const res = await apiFetch("/api/chat?action=rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, title }),
  });
  if (!res.ok) throw new Error("Failed to rename session");
}

export async function batchDeleteSessions(sessionIds: string[]): Promise<number> {
  const res = await apiFetch("/api/chat?action=batch-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_ids: sessionIds }),
  });
  if (!res.ok) throw new Error("Failed to batch delete sessions");
  const data = await res.json();
  return data.deleted ?? 0;
}
