import { useState, useRef, useEffect, forwardRef } from "react";
import "./Sidebar.css";
import {
  PanelRightClose,
  MessageSquarePlus,
  User,
  Settings,
  LogIn,
  HelpCircle,
  LogOut,
} from "lucide-react";
import type { ChatMeta, UserProfile } from "../types";

interface SidebarProps {
  open: boolean;
  chats: ChatMeta[];
  activeChatId: string | null;
  user: UserProfile | null;
  onToggle: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onShowProfile: () => void;
  onLogout: () => void;
  onTransitionEnd?: () => void;
}

export const Sidebar = forwardRef<HTMLElement, SidebarProps>(
  (
    {
      open,
      chats,
      activeChatId,
      user,
      onToggle,
      onSelectChat,
      onNewChat,
      onShowProfile,
      onLogout,
      onTransitionEnd,
    },
    ref
  ) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const footerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!menuOpen) return;
      const handler = (e: MouseEvent) => {
        if (
          footerRef.current &&
          !footerRef.current.contains(e.target as Node)
        ) {
          setMenuOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [menuOpen]);

    const menuItems = [
      {
        icon: Settings,
        label: "系统设置",
        action: () => {
          setMenuOpen(false);
          onShowProfile();
        },
      },
      { icon: HelpCircle, label: "帮助与反馈", action: () => setMenuOpen(false) },
      { icon: LogOut, label: "退出登录", action: onLogout },
    ];

    function getDateLabel(ts: number): string {
      const now = new Date();
      const date = new Date(ts);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diff = today.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const days = diff / (86400000);
      if (days < 1) return "今天";
      if (days < 2) return "昨天";
      if (days < 7) return "7天内";
      if (days < 30) return "30天内";
      return `${date.getFullYear()}-${date.getMonth() + 1}`;
    }

    type ChatGroup = { label: string; chats: ChatMeta[] };
    const groups: ChatGroup[] = [];
    const order = ["今天", "昨天", "7天内", "30天内"];
    for (const chat of chats) {
      const label = getDateLabel(chat.createdAt);
      let group = groups.find((g) => g.label === label);
      if (!group) {
        group = { label, chats: [] };
        groups.push(group);
      }
      group.chats.push(chat);
    }
    // Sort: known labels first (by order), then year-month descending
    groups.sort((a, b) => {
      const ai = order.indexOf(a.label);
      const bi = order.indexOf(b.label);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b.label.localeCompare(a.label);
    });

    return (
      <aside
        ref={ref}
        className={`sidebar${!open ? " collapsed" : ""}`}
        onTransitionEnd={(e) => {
          if (onTransitionEnd && (e as React.TransitionEvent).propertyName === "width") {
            onTransitionEnd();
          }
        }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-header">
            <span className="sidebar-brand">LifeInk AI</span>
            <button className="sidebar-toggle" onClick={onToggle}>
              <PanelRightClose size={16} />
            </button>
          </div>

          <button className="new-chat-btn" onClick={onNewChat}>
            <MessageSquarePlus size={16} />
            新对话
          </button>

          <div className="sidebar-list">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="chat-group-label">{group.label}</div>
                {group.chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`chat-item ${activeChatId === chat.id ? "active" : ""}`}
                    onClick={() => onSelectChat(chat.id)}
                  >
                    {chat.title}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sidebar-footer" ref={footerRef}>
            {user ? (
              <>
                <div
                  className="user-info"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <div className="user-avatar">
                    <User size={16} />
                  </div>
                  <span className="user-name">{user.name}</span>
                  <Settings size={14} className="user-settings-icon" />
                </div>
                {menuOpen && (
                  <div className="user-menu">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          className="user-menu-item"
                          onClick={item.action}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="user-info user-login" onClick={onShowProfile}>
                <LogIn size={16} />
                <span>登录</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    );
  }
);
