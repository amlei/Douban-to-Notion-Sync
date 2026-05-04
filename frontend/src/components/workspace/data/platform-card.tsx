"use client";

import { Loader2, RefreshCw, ChevronDown } from "lucide-react";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={icon}
            alt={label}
            className={`h-6 w-6 ${iconRounded ? "rounded" : ""}`}
          />
          <span className="font-medium text-foreground">{label}</span>
        </div>
        {bound ? (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={refreshing || syncing}>
                  {refreshing || syncing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      {refreshing && "更新中"}
                      {syncing && syncPhase && syncPhaseLabels[syncPhase]}
                      {syncing && !syncPhase && "同步中..."}
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      更新信息
                      <ChevronDown size={12} />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleRefresh}>
                  更新个人信息
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSync}>
                  同步数据
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={handleUnbind}>
              解绑
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleBind} disabled={isBinding}>
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
      </div>

      {bound && profile && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {profile.avatar && (
              <img src={profile.avatar} alt="" className="h-8 w-8 rounded-full" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {profile.name && (
              <div>
                <span className="text-muted-foreground">昵称: </span>
                <span className="text-foreground">{profile.name}</span>
              </div>
            )}
            {profile.location && (
              <div>
                <span className="text-muted-foreground">IP属地: </span>
                <span className="text-foreground">{profile.location}</span>
              </div>
            )}
            {profile.signature && platform === "douban" && (
              <div className="col-span-2">
                <span className="text-muted-foreground">签名: </span>
                <span className="text-foreground">{profile.signature}</span>
              </div>
            )}
            {profile.join_date && platform === "douban" && (
              <div>
                <span className="text-muted-foreground">加入时间: </span>
                <span className="text-foreground">{profile.join_date}</span>
              </div>
            )}
            {dataCounts && Object.keys(dataCounts).length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">已导入数据: </span>
                <div className="inline-flex gap-2 mt-1">
                  {Object.entries(dataCounts).map(([key, count]) => (
                    <span key={key} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {count} {key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
