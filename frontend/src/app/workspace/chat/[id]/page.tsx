"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { useChatStore } from "@/core/chat/use-chat-store";

const transport = new TextStreamChatTransport({
  api: "/api/chat",
});

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const store = useChatStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const initialSentRef = useRef(false);
  const sessionIdRef = useRef<string>("");
  const messagesLoadedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  // Resolve route param once
  useEffect(() => {
    params.then((p) => {
      sessionIdRef.current = p.id;
      setMounted(true);
    });
  }, [params]);

  // Custom fetch that captures X-Session-Id from response headers
  const capturedSessionId = useRef<string | null>(null);
  const transport = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      credentials: "include",
      fetch: async (input, init) => {
        const res = await globalThis.fetch(input, init);
        const sid = res.headers.get("x-session-id");
        if (sid && (!sessionIdRef.current || sessionIdRef.current === "0")) {
          capturedSessionId.current = sid;
        }
        return res;
      },
      prepareSendMessagesRequest({ messages }) {
        const lastMsg = messages[messages.length - 1];
        let content = "";
        if (lastMsg) {
          for (const part of lastMsg.parts) {
            if (part.type === "text") {
              content = part.text;
              break;
            }
          }
        }
        const sid = sessionIdRef.current;
        return {
          body: {
            content,
            session_id: sid && sid !== "0" ? sid : undefined,
          },
        };
      },
    }),
  ).current;

  // Stable chat id -- never changes during streaming
  const chatId = useRef(`chat-${Date.now()}`).current;

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: chatId,
    transport,
    onFinish: () => {
      // If we captured a new session_id, update and navigate
      if (capturedSessionId.current) {
        const sid = capturedSessionId.current;
        sessionIdRef.current = sid;
        capturedSessionId.current = null;
        store.addSession({ id: sid, title: "", createdAt: Date.now() });
        router.replace(`/workspace/chat/${sid}`, { scroll: false });
      }
      store.refreshSessions();
    },
  });

  // Load messages from backend for existing sessions (skip "0" = new session)
  useEffect(() => {
    if (!mounted) return;
    const id = sessionIdRef.current;
    if (!id || id === "0" || messagesLoadedRef.current) return;
    messagesLoadedRef.current = true;
    store.loadMessages(id).then((loaded) => {
      if (loaded && loaded.length > 0) {
        setMessages(loaded);
      }
    });
  }, [mounted, store, setMessages]);

  // Auto-send the initial message passed from /chat/new via ?q= param
  useEffect(() => {
    if (!mounted || initialSentRef.current || status !== "ready") return;
    const id = sessionIdRef.current;
    if (id && id !== "0") return;
    const q = searchParams.get("q");
    if (!q) return;
    initialSentRef.current = true;
    sendMessage({ text: q });
  }, [mounted, status, searchParams, sendMessage]);

  const handleSend = useCallback(
    (text: string) => {
      if (!text.trim() || status !== "ready") return;
      requireAuth(() => sendMessage({ text }));
    },
    [status, sendMessage, requireAuth],
  );

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <Message key={msg.id} from={msg.role}>
            <MessageContent>
              {msg.parts.map((part, i) => {
                if (part.type === "text") {
                  return <MessageResponse key={i}>{part.text}</MessageResponse>;
                }
                return null;
              })}
            </MessageContent>
          </Message>
        ))}
        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={({ text }) => handleSend(text)}
            className="rounded-xl border border-input bg-background"
          >
            <PromptInputTextarea placeholder="继续对话..." />
            <PromptInputSubmit
              status={status}
              onClick={(e) => {
                if (status === "streaming" || status === "submitted") {
                  e.preventDefault();
                  stop();
                }
              }}
            />
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
