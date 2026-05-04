"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/core/chat/use-chat-store";
import { MessageBubble } from "@/components/workspace/chat/message-bubble";

const transport = new TextStreamChatTransport({
  api: "/api/chat",
});

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatId, setChatId] = useState<string>("");
  const store = useChatStore();
  const [input, setInput] = useState("");

  useEffect(() => {
    params.then((p) => setChatId(p.id));
  }, [params]);

  const { messages, sendMessage, status, setMessages } = useChat({
    id: chatId,
    transport,
    onFinish: ({ message }) => {
      store.saveMessages(chatId, [...messages, message]);
      const title = messages[0]?.parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("")
        .slice(0, 30);
      if (title) store.updateTitle(chatId, title);
    },
  });

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (!chatId) return;
    if (prevChatIdRef.current !== chatId) {
      store.saveMessages(prevChatIdRef.current, messages);
      const saved = store.loadMessages(chatId);
      if (saved) setMessages(saved);
      prevChatIdRef.current = chatId;
    }
  }, [chatId, messages, setMessages, store]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = () => {
    if (!input.trim() || status !== "ready") return;
    sendMessage({ text: input });
    setInput("");
  };

  if (!chatId) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {(status === "submitted" || status === "streaming") && (
          <div className="flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4">
        <div className="relative max-w-2xl mx-auto">
          <textarea
            rows={3}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="继续对话..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={status !== "ready"}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSubmit}
            disabled={status !== "ready"}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
