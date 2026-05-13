"use client";

import { useRouter } from "next/navigation";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { useRequireAuth } from "@/core/auth/auth-guard";

export default function NewChatPage() {
  const router = useRouter();
  const requireAuth = useRequireAuth();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-foreground text-center">LifeInk AI</h1>
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim()) return;
            requireAuth(() => {
              router.replace(`/workspace/chat/0?q=${encodeURIComponent(text)}`);
            });
          }}
          className="rounded-xl border border-input bg-background"
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
