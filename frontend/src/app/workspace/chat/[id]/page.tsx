"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { useSearchParams } from "next/navigation";
import { Streamdown } from "streamdown";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { streamdownPlugins, humanMessagePlugins } from "@/core/streamdown/plugins";
import { useChatStore } from "@/core/chat/use-chat-store";

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const [chatId, setChatId] = useState<string>("");
  const store = useChatStore();
  const searchParams = useSearchParams();
  const initialSentRef = useRef(false);

  useEffect(() => {
    params.then((p) => setChatId(p.id));
  }, [params]);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    id: chatId,
    api: "/api/chat",
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

  // Auto-send the initial message passed from /chat/new via ?q= param
  useEffect(() => {
    if (!chatId || initialSentRef.current || status !== "ready") return;
    const q = searchParams.get("q");
    if (!q) return;
    initialSentRef.current = true;
    sendMessage({ text: q });
  }, [chatId, status, searchParams, sendMessage]);

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

  if (!chatId) return null;

  return (
    <div className="flex flex-col h-full">
      <Conversation>
        <ConversationContent className="max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <Message key={msg.id} from={msg.role}>
              <MessageContent>
                {msg.parts.map((part, i) => {
                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={i}
                        isStreaming={part.state === "streaming"}
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }
                  if (part.type !== "text") return null;
                  if (msg.role === "user") {
                    return (
                      <Streamdown key={i} {...humanMessagePlugins}>
                        {part.text}
                      </Streamdown>
                    );
                  }
                  return (
                    <MessageResponse key={i} {...streamdownPlugins}>
                      {part.text}
                    </MessageResponse>
                  );
                })}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          <PromptInput
            onSubmit={({ text }) => {
              if (!text.trim() || status !== "ready") return;
              sendMessage({ text });
            }}
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
