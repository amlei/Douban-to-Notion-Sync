"use client";

import { useState } from "react";
import { RefreshCw, BookOpen } from "lucide-react";
import { SyncManage } from "@/components/workspace/data/sync-manage";
import { Collection } from "@/components/workspace/data/collection";
import { useAllBindings } from "@/core/community/queries";

type Tab = "sync" | "data";

const tabs: { key: Tab; label: string; icon: typeof RefreshCw }[] = [
  { key: "sync", label: "平台绑定", icon: RefreshCw },
  { key: "data", label: "查看数据", icon: BookOpen },
];

export default function DataPage() {
  const [tab, setTab] = useState<Tab>("sync");
  const { data: bindings } = useAllBindings();

  const doubanBound = bindings?.douban?.bound ?? false;
  const wereadBound = bindings?.weread?.bound ?? false;
  const flomoBound = bindings?.flomo?.bound ?? false;

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border px-6 pt-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === "sync" && <SyncManage />}
        {tab === "data" && (
          <Collection
            doubanBound={doubanBound}
            wereadBound={wereadBound}
            flomoBound={flomoBound}
          />
        )}
      </div>
    </div>
  );
}
