import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";

export function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return part.text.split("\n").map((line, j) => (
              <p key={`${i}-${j}`} className={line === "" ? "h-3" : ""}>
                {line}
              </p>
            ));
          }
          return null;
        })}
      </div>
    </div>
  );
}
