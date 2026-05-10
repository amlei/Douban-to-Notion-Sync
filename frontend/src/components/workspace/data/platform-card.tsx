"use client";

import { Loader2, MoreHorizontal, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PlatformBindingState } from "@/core/community/use-platform-binding";

interface PlatformCardProps {
  platform: string;
  icon: string;
  iconRounded: boolean;
  label: string;
  binding: PlatformBindingState;
  dataCounts?: Record<string, number>;
}

export function PlatformCard({ platform, icon, iconRounded, label, binding, dataCounts }: PlatformCardProps) {
  const {
    bound, profile, binding: isBinding, bindPhase,
    refreshing, syncing, syncPhase, scrapePhase,
    handleBind, handleUnbind, handleRefresh, handleSync,
  } = binding;

  const syncPhaseLabels: Record<string, string> = platform === "douban"
    ? { books: "正在同步图书...", movies: "正在同步影视..." }
    : platform === "flomo"
    ? { exported: "正在下载导出文件...", parsed: "正在解析备忘录..." }
    : { books: "正在同步图书...", bookmarks: "正在同步笔记..." };

  const bindPhaseLabels: Record<string, string> = platform === "douban"
    ? { books: "正在导入图书...", movies: "正在导入影视..." }
    : platform === "flomo"
    ? { exported: "正在下载导出文件...", parsed: "正在解析备忘录..." }
    : { books: "正在导入图书...", bookmarks: "正在导入笔记..." };

  return (
    <div className="group relative rounded-lg border bg-card p-4 h-[120px] flex flex-col justify-between overflow-hidden">
      {/* Row 1: platform icon + label, hover actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={icon}
            alt={label}
            className={`h-5 w-5 ${iconRounded ? "rounded" : ""}`}
          />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>

        {!bound && (
          <Button size="sm" variant="outline" onClick={handleBind} disabled={isBinding}>
            {isBinding ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {bindPhase === "pending" && "等待扫码"}
                {bindPhase === "scanned" && "扫码成功"}
                {bindPhase === "logged_in" && "登录成功"}
                {bindPhase === "fetching_profile" && "获取资料"}
                {bindPhase === "scraping" && scrapePhase && bindPhaseLabels[scrapePhase]}
              </>
            ) : (
              "绑定"
            )}
          </Button>
        )}

        {bound && (refreshing || syncing) && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            {refreshing && "更新中"}
            {syncing && syncPhase && syncPhaseLabels[syncPhase]}
            {syncing && !syncPhase && "同步中..."}
          </div>
        )}

        {bound && !refreshing && !syncing && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw size={14} />
                  更新信息
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSync}>
                  <RefreshCw size={14} />
                  同步数据
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUnbind} className="text-destructive focus:text-destructive">
                  <Unplug size={14} />
                  解绑
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Row 2: avatar + name + data counts */}
      {bound && (
        <div className="flex items-center gap-3">
          {profile?.avatar && (
            <img src={profile.avatar} alt="" className="h-8 w-8 rounded-full shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {profile?.name ?? label}
            </p>
            {dataCounts && Object.keys(dataCounts).length > 0 && (
              <div className="flex gap-1.5 mt-0.5">
                {Object.entries(dataCounts).map(([key, count]) => (
                  <span key={key} className="text-xs text-muted-foreground">
                    {count} {key}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
