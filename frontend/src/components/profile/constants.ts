import { Settings, User, Database, FileText } from "lucide-react";
import type { StrengthLevel } from "../../utils/password";

export const tabs = [
  { id: "general", label: "通用设置", icon: Settings },
  { id: "account", label: "帐号管理", icon: User },
  { id: "data", label: "数据管理", icon: Database },
  { id: "terms", label: "服务协议", icon: FileText },
] as const;

export const platforms = [
  { id: "douban", label: "豆瓣", icon: "/douban.svg", rounded: false },
  { id: "flomo", label: "flomo", icon: "/flomoapp.svg", rounded: false },
  { id: "weread", label: "微信读书", icon: "/weread.webp", rounded: true },
] as const;

export const STRENGTH_COLORS: Record<StrengthLevel, [string, string, string]> = {
  0: ["var(--border)", "var(--border)", "var(--border)"],
  1: ["#ef4444", "var(--border)", "var(--border)"],
  2: ["#f59e0b", "#f59e0b", "var(--border)"],
  3: ["#22c55e", "#22c55e", "#22c55e"],
};

export const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  0: "",
  1: "弱",
  2: "中",
  3: "强",
};
