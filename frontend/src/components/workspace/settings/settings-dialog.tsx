"use client";

import { useState } from "react";
import { Settings, User, Database, FileText, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "@/components/workspace/settings/general-settings";
import { AccountManage } from "@/components/workspace/settings/account-manage";
import { DataManage } from "@/components/workspace/settings/data-manage";
import { ServiceAgreement } from "@/components/workspace/settings/service-agreement";
import { SyncManage } from "@/components/workspace/settings/sync-manage";
import { Collection } from "@/components/workspace/data/collection";
import { useCommunityDataState } from "@/components/workspace/settings/sync-manage";

type TabKey = "general" | "account" | "data" | "terms";
type DataView = "sync" | "data" | null;

const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "通用设置", icon: Settings },
  { key: "account", label: "帐号管理", icon: User },
  { key: "data", label: "数据管理", icon: Database },
  { key: "terms", label: "服务协议", icon: FileText },
];

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<TabKey>("general");
  const [dataView, setDataView] = useState<DataView>(null);

  // Full-panel mode: sync/data views take the entire dialog
  if (dataView) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[85vw] sm:max-w-[1200px] h-[80vh] min-w-[560px] min-h-[400px] p-0 gap-0 overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>{dataView === "sync" ? "同步数据" : "查看数据"}</DialogTitle>
          </VisuallyHidden>
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 px-6 pt-5 pb-3">
              <button
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setDataView(null)}
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-sm font-semibold text-foreground">
                {dataView === "sync" ? "同步数据" : "查看数据"}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {dataView === "sync" && <SyncManage />}
              {dataView === "data" && <DataViewContent />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Normal mode: left sidebar + right content
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[85vw] sm:max-w-[1200px] h-[80vh] min-w-[560px] min-h-[400px] p-0 gap-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>设置</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-full">
          {/* Left sidebar */}
          <div className="w-44 shrink-0 border-r border-border py-2 px-2 flex flex-col">
            <div className="px-3 py-2 mb-1">
              <span className="text-sm font-semibold text-foreground">设置</span>
            </div>
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <Icon size={15} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-6 pt-5 pb-3">
              <h2 className="text-sm font-semibold text-foreground">
                {tabs.find((t) => t.key === tab)?.label}
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {tab === "general" && <GeneralSettings />}
              {tab === "account" && (
                <AccountManage onLogoutSuccess={() => onOpenChange(false)} />
              )}
              {tab === "data" && (
                <DataManage onNavigate={setDataView} />
              )}
              {tab === "terms" && <ServiceAgreement />}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DataViewContent() {
  const {
    doubanBound, wereadBound, flomoBound,
    books, wereadBooks, movies, notes,
    wereadBookmarks, flomoMemos,
  } = useCommunityDataState();

  return (
    <Collection
      doubanBound={doubanBound}
      wereadBound={wereadBound}
      flomoBound={flomoBound}
      books={books}
      wereadBooks={wereadBooks}
      movies={movies}
      notes={notes}
      wereadBookmarks={wereadBookmarks}
      flomoMemos={flomoMemos}
    />
  );
}
