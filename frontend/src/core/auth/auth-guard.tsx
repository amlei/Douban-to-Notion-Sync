"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthGuardContextType {
  requireAuth: (callback?: () => void) => boolean;
}

const AuthGuardContext = createContext<AuthGuardContextType | null>(null);

export function AuthGuardProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const requireAuth = useCallback(
    (callback?: () => void): boolean => {
      if (isAuthenticated) {
        callback?.();
        return true;
      }
      setOpen(true);
      return false;
    },
    [isAuthenticated],
  );

  const handleLogin = useCallback(() => {
    setOpen(false);
    router.push("/login");
  }, [router]);

  return (
    <AuthGuardContext.Provider value={{ requireAuth }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>请先登录</DialogTitle>
            <DialogDescription>登录后即可使用完整功能</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleLogin}>前往登录</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthGuardContext.Provider>
  );
}

export function useRequireAuth() {
  const ctx = useContext(AuthGuardContext);
  if (!ctx)
    throw new Error("useRequireAuth must be used within AuthGuardProvider");
  return ctx.requireAuth;
}
