"use client";

import { ChevronRight, RefreshCw, BookOpen } from "lucide-react";

interface DataManageProps {
  onNavigate?: (view: "sync" | "data") => void;
}

export function DataManage({ onNavigate }: DataManageProps) {
  return (
    <div className="space-y-2">
      <button
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent transition-colors text-left"
        onClick={() => onNavigate?.("sync")}
      >
        <div className="flex items-center gap-3">
          <RefreshCw size={16} className="text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">同步数据</div>
            <div className="text-xs text-muted-foreground">绑定第三方平台，同步书影音数据</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
      <button
        className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-accent transition-colors text-left"
        onClick={() => onNavigate?.("data")}
      >
        <div className="flex items-center gap-3">
          <BookOpen size={16} className="text-muted-foreground" />
          <div>
            <div className="text-sm font-medium text-foreground">查看数据</div>
            <div className="text-xs text-muted-foreground">浏览已同步的图书、电影、笔记等</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground" />
      </button>
    </div>
  );
}
