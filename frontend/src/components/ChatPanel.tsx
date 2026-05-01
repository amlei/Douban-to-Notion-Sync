import { useState, useRef, useEffect } from "react";
import "./ChatPanel.css";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import { Send } from "lucide-react";
import type { ChatStore } from "../hooks/useChatStore";
import { MessageBubble } from "./MessageBubble";

const transport = new TextStreamChatTransport({
  api: "/api/chat",
});

interface ChatPanelProps {
  chatId: string;
  store: ChatStore;
}

export function ChatPanel({ chatId, store }: ChatPanelProps) {
  const [input, setInput] = useState("");

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

  return (
    <>
      <div className="messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {(status === "submitted" || status === "streaming") && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-bar">
        <div className="input-box">
          <textarea
            rows={4}
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
          <button
            className="send-btn"
            onClick={handleSubmit}
            disabled={status !== "ready"}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
