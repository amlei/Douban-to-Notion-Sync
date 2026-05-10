"use client";

import { useRouter } from "next/navigation";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { useChatStore } from "@/core/chat/use-chat-store";

export default function NewChatPage() {
  const router = useRouter();
  const store = useChatStore();

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-foreground text-center">LifeInk AI</h1>
        <PromptInput
          onSubmit={({ text }) => {
            if (!text.trim()) return;
            const id = store.createChat();
            store.updateTitle(id, text.slice(0, 30));
            router.replace(`/workspace/chat/${id}?q=${encodeURIComponent(text)}`);
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
