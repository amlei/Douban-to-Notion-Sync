"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CopyIcon, MessageSquarePlus, RefreshCcwIcon } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/core/chat/use-chat-store";
import { useRequireAuth } from "@/core/auth/auth-guard";

const suggestions = [
  "帮我总结一下最近的阅读笔记",
  "推荐一部适合周末看的电影",
  "分析我最近的日记情绪变化",
  "根据我的兴趣推荐一本书",
];

function MessageParts({
  message,
  isLastMessage,
  isStreaming,
}: {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
}) {
  const reasoningParts = message.parts.filter((part) => part.type === "reasoning");
  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n");
  const hasReasoning = reasoningParts.length > 0;
  const lastPart = message.parts.at(-1);
  const isReasoningStreaming =
    isLastMessage && isStreaming && lastPart?.type === "reasoning";

  return (
    <>
      {hasReasoning && (
        <Reasoning className="w-full" isStreaming={isReasoningStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      )}
      {message.parts.map((part, i) => {
        if (part.type !== "text") return null;
        return (
          <MessageResponse key={`${message.id}-${i}`}>
            {part.text}
          </MessageResponse>
        );
      })}
    </>
  );
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const store = useChatStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requireAuth = useRequireAuth();
  const initialSentRef = useRef(false);
  const sessionIdRef = useRef<string>("");
  const messagesLoadedRef = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    params.then((p) => {
      sessionIdRef.current = p.id;
      setMounted(true);
    });
  }, [params]);

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

  const chatId = useRef(`chat-${Date.now()}`).current;

  const { messages, sendMessage, status, setMessages, stop, regenerate } = useChat({
    id: chatId,
    transport,
    onFinish: () => {
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
    (message: PromptInputMessage) => {
      if (!message.text.trim() || status !== "ready") return;
      requireAuth(() => sendMessage({ text: message.text }));
    },
    [status, sendMessage, requireAuth],
  );

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
  }, []);

  const isStreaming = status === "streaming";
  const hasMessages = messages.length > 0 || status === "submitted" || isStreaming;
  const isNewSession = !sessionIdRef.current || sessionIdRef.current === "0";
  const isLoadingSession = mounted && !isNewSession && messages.length === 0;

  if (!mounted) return null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Loading state for existing sessions */}
      {isLoadingSession && (
        <div className="flex-1 flex items-center justify-center">
          <Shimmer className="text-lg">加载对话中...</Shimmer>
        </div>
      )}

      {/* Logo + suggestions - fades out when messages appear */}
      <AnimatePresence>
        {!hasMessages && !isLoadingSession && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col items-center justify-center p-4"
          >
            <div className="w-full max-w-2xl flex flex-col items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <MessageSquarePlus size={28} />
                </div>
                <h1 className="text-2xl font-semibold">LifeInk AI</h1>
                <p className="text-muted-foreground">与你的阅读、观影、日记对话</p>
              </div>
              <Suggestions>
                {suggestions.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={(text) => handleSend({ text } as PromptInputMessage)}
                  />
                ))}
              </Suggestions>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation - appears when messages exist */}
      {hasMessages && (
        <Conversation>
          <ConversationContent className="max-w-3xl mx-auto w-full">
            {messages.map((message, messageIndex) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <MessageParts
                    message={message}
                    isLastMessage={messageIndex === messages.length - 1}
                    isStreaming={isStreaming}
                  />
                </MessageContent>
                {message.role === "assistant" &&
                  messageIndex === messages.length - 1 && (
                    <MessageActions>
                      <MessageAction
                        onClick={() => regenerate()}
                        tooltip="重新生成"
                      >
                        <RefreshCcwIcon className="size-3" />
                      </MessageAction>
                      <MessageAction
                        onClick={() => {
                          const text = message.parts
                            .filter((p) => p.type === "text")
                            .map((p) => p.text)
                            .join("");
                          handleCopy(text);
                        }}
                        tooltip="复制"
                      >
                        <CopyIcon className="size-3" />
                      </MessageAction>
                    </MessageActions>
                  )}
              </Message>
            ))}
            {status === "submitted" && <Spinner />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {/* Input - animates from center to bottom via layout */}
      <motion.div
        layout
        transition={{ layout: { duration: 0.4, ease: "easeInOut" } }}
        className={cn(
          "bg-background p-4",
          hasMessages ? "sticky bottom-0" : "",
          !hasMessages && !isLoadingSession ? "flex justify-center" : "",
        )}
      >
        <div className={cn("mx-auto", hasMessages ? "max-w-3xl" : "max-w-2xl w-full")}>
          <PromptInput
            onSubmit={handleSend}
            className="rounded-xl border border-input bg-background"
          >
            <PromptInputTextarea
              placeholder={hasMessages ? "继续对话..." : "询问你的阅读、观影、日记..."}
              className={cn(!hasMessages && "min-h-24")}
            />
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
      </motion.div>
    </div>
  );
}
