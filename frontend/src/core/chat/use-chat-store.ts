import { useState, useCallback, useRef } from "react";
import type { UIMessage } from "ai";
import type { ChatMeta } from "./types";

export function useChatStore() {
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const messageCache = useRef(new Map<string, UIMessage[]>());

  const createChat = useCallback((): string => {
    const id = crypto.randomUUID();
    const chat: ChatMeta = { id, title: "New Chat", createdAt: Date.now() };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(id);
    return id;
  }, []);

  const switchChat = useCallback((id: string | null) => {
    setActiveChatId(id);
  }, []);

  const deleteChat = useCallback((id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    messageCache.current.delete(id);
  }, []);

  const updateTitle = useCallback((id: string, title: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const saveMessages = useCallback((id: string, messages: UIMessage[]) => {
    messageCache.current.set(id, messages);
  }, []);

  const loadMessages = useCallback((id: string): UIMessage[] | undefined => {
    return messageCache.current.get(id);
  }, []);

  return {
    chats,
    activeChatId,
    createChat,
    switchChat,
    deleteChat,
    updateTitle,
    saveMessages,
    loadMessages,
  };
}

export type ChatStore = ReturnType<typeof useChatStore>;
