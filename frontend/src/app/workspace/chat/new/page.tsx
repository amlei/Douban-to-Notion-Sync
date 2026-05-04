"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/core/chat/use-chat-store";

export default function NewChatPage() {
  const router = useRouter();
  const store = useChatStore();
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (!input.trim()) return;
    const id = store.createChat();
    store.updateTitle(id, input.slice(0, 30));
    router.replace(`/workspace/chat/${id}`);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-foreground text-center">LifeInk AI</h1>
        <div className="relative">
          <textarea
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="询问你的阅读、观影、日记..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSubmit}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
