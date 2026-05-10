"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquarePlus,
  User,
  Settings,
  LogIn,
  LogOut,
  HelpCircle,
  Database,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/core/auth/AuthProvider";
import { useChatStore } from "@/core/chat/use-chat-store";
import { useSettingsDialog } from "@/components/workspace/use-settings-dialog";

export function WorkspaceSidebar() {
  const { user, logout } = useAuth();
  const store = useChatStore();
  const { setSettingsOpen } = useSettingsDialog();
  const router = useRouter();
  const { state: sidebarState } = useSidebar();

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Manage mode state
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation dialog state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "single" | "batch";
    ids: string[];
  } | null>(null);

  const isCollapsed = sidebarState === "collapsed";

  // Auto-focus rename input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Exit manage mode when sidebar collapses
  useEffect(() => {
    if (isCollapsed && manageMode) {
      setManageMode(false);
      setSelectedIds(new Set());
    }
  }, [isCollapsed, manageMode]);

  const startRename = useCallback((chatId: string, currentTitle: string) => {
    setEditingId(chatId);
    setEditTitle(currentTitle);
  }, []);

  const commitRename = useCallback(async () => {
    if (!editingId) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    await store.renameChat(editingId, trimmed);
    setEditingId(null);
    toast.success("已重命名");
  }, [editingId, editTitle, store]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
  }, []);

  const startSingleDelete = useCallback((chatId: string) => {
    setDeleteTarget({ type: "single", ids: [chatId] });
  }, []);

  const startBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setDeleteTarget({ type: "batch", ids: Array.from(selectedIds) });
  }, [selectedIds]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { type, ids } = deleteTarget;
    try {
      if (type === "single") {
        await store.deleteChat(ids[0]);
        toast.success("已删除");
      } else {
        await store.batchDeleteChats(ids);
        toast.success(`已删除 ${ids.length} 个对话`);
      }
    } catch {
      toast.error("删除失败");
    }
    setDeleteTarget(null);
    if (manageMode) {
      setManageMode(false);
      setSelectedIds(new Set());
    }
    // Redirect if active chat was deleted
    if (ids.includes(store.activeChatId ?? "")) {
      router.push("/workspace/chat/new");
    }
  }, [deleteTarget, store, manageMode, router]);

  const toggleSelect = useCallback((chatId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === store.chats.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(store.chats.map((c) => c.id)));
    }
  }, [selectedIds.size, store.chats]);

  const exitManageMode = useCallback(() => {
    setManageMode(false);
    setSelectedIds(new Set());
  }, []);

  function getDateLabel(ts: number): string {
    const now = new Date();
    const date = new Date(ts);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const days = diff / 86400000;
    if (days < 1) return "今天";
    if (days < 2) return "昨天";
    if (days < 7) return "7天内";
    if (days < 30) return "30天内";
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
  }

  type ChatGroup = { label: string; chats: typeof store.chats };
  const groups: ChatGroup[] = [];
  const order = ["今天", "昨天", "7天内", "30天内"];
  for (const chat of store.chats) {
    const label = getDateLabel(chat.createdAt);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, chats: [] };
      groups.push(group);
    }
    group.chats.push(chat);
  }
  groups.sort((a, b) => {
    const ai = order.indexOf(a.label);
    const bi = order.indexOf(b.label);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return b.label.localeCompare(a.label);
  });

  const activeChatId = store.activeChatId;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/workspace/chat/new">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquarePlus size={16} />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">LifeInk AI</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/workspace/data">
                    <Database size={16} />
                    <span>数据管理</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                {!manageMode ? (
                  <>
                    <SidebarMenuButton asChild>
                      <Link href="/workspace/chat/new">
                        <MessageSquarePlus size={16} />
                        <span>新对话</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      showOnHover
                      onClick={() => setManageMode(true)}
                      title="管理对话"
                    >
                      <CheckSquare size={14} />
                    </SidebarMenuAction>
                  </>
                ) : (
                  <SidebarMenuButton disabled>
                    <CheckSquare size={16} />
                    <span>管理对话</span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {manageMode && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="flex items-center gap-1 px-2 py-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  onClick={toggleSelectAll}
                >
                  {selectedIds.size === store.chats.length && store.chats.length > 0
                    ? "取消全选"
                    : "全选"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 flex-1 text-xs"
                  disabled={selectedIds.size === 0}
                  onClick={startBatchDelete}
                >
                  删除所选 ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={exitManageMode}
                >
                  取消
                </Button>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {groups.length > 0 && (
          <SidebarGroup>
            {groups.map((group) => (
              <div key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.chats.map((chat) => (
                      <SidebarMenuItem key={chat.id}>
                        {manageMode ? (
                          <SidebarMenuButton
                            isActive={selectedIds.has(chat.id)}
                            onClick={() => toggleSelect(chat.id)}
                          >
                            {selectedIds.has(chat.id) ? (
                              <CheckSquare size={16} className="shrink-0" />
                            ) : (
                              <Square size={16} className="shrink-0" />
                            )}
                            <span className="truncate">{chat.title}</span>
                          </SidebarMenuButton>
                        ) : editingId === chat.id ? (
                          <div className="flex w-full items-center gap-1 px-2">
                            <Input
                              ref={editInputRef}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") cancelRename();
                              }}
                              onBlur={commitRename}
                              className="h-7 text-sm"
                            />
                          </div>
                        ) : (
                          <>
                            <SidebarMenuButton
                              asChild
                              isActive={activeChatId === chat.id}
                            >
                              <Link href={`/workspace/chat/${chat.id}`}>
                                <span className="truncate">{chat.title}</span>
                              </Link>
                            </SidebarMenuButton>
                            <SidebarMenuAction showOnHover>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="flex items-center justify-center">
                                    <MoreHorizontal size={14} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start" className="w-36">
                                  <DropdownMenuItem onClick={() => startRename(chat.id, chat.title)}>
                                    <Pencil size={14} />
                                    重命名
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => startSingleDelete(chat.id)}
                                  >
                                    <Trash2 size={14} />
                                    删除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SidebarMenuAction>
                          </>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </div>
            ))}
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="w-full">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback>
                        <User size={16} />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-medium text-sm">{user.name}</span>
                    </div>
                    <Settings size={14} className="ml-auto text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" className="w-48">
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    <Settings size={14} />
                    系统设置
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HelpCircle size={14} />
                    帮助与反馈
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout}>
                    <LogOut size={14} />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/login">
                  <LogIn size={16} />
                  <span>登录</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "batch"
                ? `确定要删除选中的 ${deleteTarget.ids.length} 个对话吗？此操作无法撤销。`
                : "确定要删除这个对话吗？此操作无法撤销。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
