"use client";

import { useState } from "react";
import { User, Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/core/auth/AuthProvider";
import { updateProfile, changePassword } from "@/core/api/auth";
import { getPasswordStrength } from "@/core/utils/password";
import type { StrengthLevel } from "@/core/utils/password";
import { useRouter } from "next/navigation";

function StrengthBar({ level }: { level: StrengthLevel }) {
  const colors: Record<StrengthLevel, [string, string, string]> = {
    0: ["hsl(var(--border))", "hsl(var(--border))", "hsl(var(--border))"],
    1: ["#ef4444", "hsl(var(--border))", "hsl(var(--border))"],
    2: ["#f59e0b", "#f59e0b", "hsl(var(--border))"],
    3: ["#22c55e", "#22c55e", "#22c55e"],
  };
  const c = colors[level];
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex gap-1">
        {c.map((color, i) => (
          <div key={i} className="h-1 w-6 rounded-full" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}

export function AccountManage({ onLogoutSuccess }: { onLogoutSuccess?: () => void }) {
  const { user, refreshUser, logout } = useAuth();
  const router = useRouter();

  const [editField, setEditField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showPwModal, setShowPwModal] = useState(false);
  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  if (!user) return null;

  const maskEmail = (email: string) => {
    const at = email.indexOf("@");
    if (at <= 2) return email;
    return email[0] + email[1] + email[2] + "******" + email.slice(at - 3);
  };

  const startEdit = (field: string) => {
    setEditName(user.name);
    setEditBio(user.bio ?? "");
    setError(null);
    setEditField(field);
  };

  const cancelEdit = () => {
    setEditField(null);
    setError(null);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        await updateProfile({ avatar: dataUrl });
        await refreshUser();
      } catch {
        setError("头像更新失败");
      }
    };
    reader.readAsDataURL(file);
  };

  const saveField = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        name: editName,
        bio: editBio || undefined,
      });
      await refreshUser();
      setEditField(null);
    } catch {
      setError("保存失败");
    }
    setSaving(false);
  };

  const savePassword = async () => {
    setPwError(null);
    if (!pwNew || pwNew.length < 6) {
      setPwError("新密码至少需要 6 个字符");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("两次输入的密码不一致");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(pwOld, pwNew);
      setShowPwModal(false);
      setPwOld("");
      setPwNew("");
    } catch (e: unknown) {
      setPwError(e instanceof Error ? e.message : "修改失败");
    }
    setPwSaving(false);
  };

  const handleLogout = async () => {
    await logout();
    onLogoutSuccess?.();
    router.push("/login");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {/* Avatar */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">头像</span>
          <label className="cursor-pointer" title="更换头像">
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            <Avatar className="h-8 w-8">
              {user.avatar ? (
                <AvatarImage src={user.avatar} alt="" />
              ) : (
                <AvatarFallback><User size={16} /></AvatarFallback>
              )}
            </Avatar>
          </label>
        </div>

        {/* Name */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">用户名</span>
          <div className="flex items-center gap-2">
            {editField === "name" ? (
              <>
                <Input className="h-8 w-40 text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveField} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X size={14} />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-foreground">{user.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit("name")}>
                  <Pencil size={14} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">个人简介</span>
          <div className="flex items-center gap-2">
            {editField === "bio" ? (
              <>
                <Input className="h-8 w-40 text-sm" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="一句话介绍自己" />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveField} disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                  <X size={14} />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-foreground">{user.bio || "未填写"}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit("bio")}>
                  <Pencil size={14} />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Email */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">邮箱</span>
          <span className="text-sm text-foreground">{maskEmail(user.email)}</span>
        </div>

        {/* Password */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-muted-foreground">密码</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">******</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
              setPwOld("");
              setPwNew("");
              setPwConfirm("");
              setPwError(null);
              setShowPwModal(true);
            }}>
              <Pencil size={14} />
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          退出登录
        </Button>
      </div>

      <Dialog open={showPwModal} onOpenChange={setShowPwModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">当前密码</label>
              <Input type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">新密码</label>
              <Input type="password" placeholder="至少 6 位" value={pwNew} onChange={(e) => setPwNew(e.target.value)} />
              {pwNew && <StrengthBar level={getPasswordStrength(pwNew)} />}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">确认新密码</label>
              <Input type="password" placeholder="再次输入新密码" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
            </div>
            {pwError && <p className="text-sm text-destructive">{pwError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPwModal(false)}>取消</Button>
              <Button onClick={savePassword} disabled={pwSaving}>
                {pwSaving ? <Loader2 size={14} className="animate-spin" /> : "确认修改"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
