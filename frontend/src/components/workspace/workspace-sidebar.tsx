"use client";

import Link from "next/link";
import {
  MessageSquarePlus,
  User,
  Settings,
  LogIn,
  LogOut,
  HelpCircle,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/core/auth/AuthProvider";
import { useChatStore } from "@/core/chat/use-chat-store";
import { useSettingsDialog } from "@/components/workspace/use-settings-dialog";

export function WorkspaceSidebar() {
  const { user, logout } = useAuth();
  const store = useChatStore();
  const { setSettingsOpen } = useSettingsDialog();

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
                <SidebarMenuButton asChild>
                  <Link href="/workspace/chat/new">
                    <MessageSquarePlus size={16} />
                    <span>新对话</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.length > 0 && (
          <SidebarGroup>
            {groups.map((group) => (
              <div key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.chats.map((chat) => (
                      <SidebarMenuItem key={chat.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={activeChatId === chat.id}
                        >
                          <Link href={`/workspace/chat/${chat.id}`}>
                            <span className="truncate">{chat.title}</span>
                          </Link>
                        </SidebarMenuButton>
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
    </Sidebar>
  );
}
