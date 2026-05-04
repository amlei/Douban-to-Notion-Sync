"use client";

import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
] as const;

export function GeneralSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">主题</p>
      <div className="flex gap-2">
        {themeOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer",
              theme === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
