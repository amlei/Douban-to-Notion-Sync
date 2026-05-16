"use client";

import { useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Suggestions, Suggestion } from "@/components/ai-elements/suggestion";
import { useRequireAuth } from "@/core/auth/auth-guard";

const suggestions = [
  "帮我总结一下最近的阅读笔记",
  "推荐一部适合周末看的电影",
  "分析我最近的日记情绪变化",
  "根据我的兴趣推荐一本书",
];

export default function NewChatPage() {
  const router = useRouter();
  const requireAuth = useRequireAuth();

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    requireAuth(() => {
      router.replace(`/workspace/chat/0?q=${encodeURIComponent(text)}`);
    });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MessageSquarePlus size={28} />
          </div>
          <h1 className="text-2xl font-semibold">LifeInk AI</h1>
          <p className="text-muted-foreground">与你的阅读、观影、日记对话</p>
        </div>

        {/* Suggestions */}
        <Suggestions>
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={handleSend}
            />
          ))}
        </Suggestions>

        {/* Input */}
        <PromptInput
          onSubmit={({ text }) => handleSend(text)}
          className="w-full rounded-xl border border-input bg-background"
        >
          <PromptInputTextarea
            placeholder="询问你的阅读、观影、日记..."
            className="min-h-24"
          />
          <PromptInputSubmit />
        </PromptInput>
      </div>
    </div>
  );
}
