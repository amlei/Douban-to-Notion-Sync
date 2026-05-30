"use client";

import { useState } from "react";
import { Settings, User, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { cn } from "@/lib/utils";
import { GeneralSettings } from "@/components/workspace/settings/general-settings";
import { AccountManage } from "@/components/workspace/settings/account-manage";
import { ServiceAgreement } from "@/components/workspace/settings/service-agreement";

type TabKey = "general" | "account" | "terms";

const tabs: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "general", label: "通用设置", icon: Settings },
  { key: "account", label: "帐号管理", icon: User },
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
            <ScrollArea className="flex-1">
              <div className="px-6 pb-6">
              {tab === "general" && <GeneralSettings />}
              {tab === "account" && (
                <AccountManage onLogoutSuccess={() => onOpenChange(false)} />
              )}
              {tab === "terms" && <ServiceAgreement />}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
