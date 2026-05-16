import { useState, useCallback, useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import type { ChatMeta } from "./types";
import { listSessions, deleteSession, getMessages, renameSession, batchDeleteSessions } from "@/core/chat/api";
import type { ChatMessage } from "@/core/chat/api";

function toUIMessages(msgs: ChatMessage[]): UIMessage[] {
  return msgs.map((m) => {
    const parts: UIMessage["parts"] = [];
    if (m.reasoning) {
      parts.push({ type: "reasoning", text: m.reasoning, state: "done" });
    }
    parts.push({ type: "text", text: m.content });
    return {
      id: `msg-${m.id}`,
      role: m.role as "user" | "assistant" | "system",
      parts,
      createdAt: new Date(m.created_at),
    };
  });
}

export function useChatStore() {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const messageCache = useRef(new Map<string, UIMessage[]>());

  // Load sessions from backend on mount
  useEffect(() => {
    if (loaded) return;
    listSessions()
      .then((sessions) => {
        setChats(sessions);
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [loaded]);

  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await listSessions();
      setChats(sessions);
    } catch {
      // Silently fail
    }
  }, []);

  const switchChat = useCallback((id: string | null) => {
    setActiveChatId(id);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    try {
      await deleteSession(id);
    } catch {
      // Optimistically remove from local state anyway
    }
    setChats((prev) => prev.filter((c) => c.id !== id));
    messageCache.current.delete(id);
    if (activeChatId === id) setActiveChatId(null);
  }, [activeChatId]);

  const updateTitle = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const renameChat = useCallback(async (id: string, title: string) => {
    try {
      await renameSession(id, title);
    } catch {
      // Optimistically update anyway
    }
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const batchDeleteChats = useCallback(async (ids: string[]) => {
    try {
      await batchDeleteSessions(ids);
    } catch {
      // Optimistically remove from local state anyway
    }
    const idSet = new Set(ids);
    setChats((prev) => prev.filter((c) => !idSet.has(c.id)));
    for (const id of ids) {
      messageCache.current.delete(id);
    }
    if (activeChatId && idSet.has(activeChatId)) setActiveChatId(null);
  }, [activeChatId]);

  const loadMessages = useCallback(
    async (id: string): Promise<UIMessage[] | undefined> => {
      const cached = messageCache.current.get(id);
      if (cached) return cached;
      try {
        const msgs = await getMessages(id);
        const uiMsgs = toUIMessages(msgs);
        messageCache.current.set(id, uiMsgs);
        return uiMsgs;
      } catch {
        return undefined;
      }
    },
    [],
  );

  const cacheMessages = useCallback((id: string, messages: UIMessage[]) => {
    messageCache.current.set(id, messages);
  }, []);

  const addSession = useCallback((session: ChatMeta) => {
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== session.id);
      return [session, ...filtered];
    });
    setActiveChatId(session.id);
  }, []);

  return {
    chats,
    activeChatId,
    switchChat,
    deleteChat,
    updateTitle,
    renameChat,
    batchDeleteChats,
    loadMessages,
    cacheMessages,
    addSession,
    refreshSessions,
  };
}

export type ChatStore = ReturnType<typeof useChatStore>;
