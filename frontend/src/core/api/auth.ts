import { apiFetch } from "./client";
import type { UserProfile } from "../auth/types";

async function authFetch(body: Record<string, unknown>): Promise<Response> {
  return apiFetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function parseError(res: Response): Promise<never> {
  const data = await res.json();
  throw new Error(
    Array.isArray(data.detail)
      ? data.detail.join(", ")
      : data.detail ?? "请求失败",
  );
}

export async function register(email: string): Promise<{ message: string }> {
  const res = await authFetch({ action: "register", email });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function verifyAndCreate(
  email: string,
  code: string,
  password: string,
): Promise<{ access_token: string; user: UserProfile }> {
  const res = await authFetch({ action: "verify", email, code, password });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function login(
  email: string,
  password: string,
): Promise<{ access_token: string; user: UserProfile }> {
  const res = await authFetch({ action: "login", email, password });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function getMe(): Promise<UserProfile> {
  const res = await authFetch({ action: "mine" });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function updateProfile(data: {
  name?: string;
  avatar?: string;
  bio?: string;
}): Promise<UserProfile> {
  const res = await authFetch({ action: "update-profile", ...data });
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

export async function changePassword(
  old_password: string,
  new_password: string,
): Promise<{ message: string }> {
  const res = await authFetch({ action: "change-password", old_password, new_password });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteAccount(): Promise<{ message: string }> {
  const res = await authFetch({ action: "delete" });
  if (!res.ok) throw new Error("注销失败");
  return res.json();
}

export async function logout(): Promise<void> {
  try {
    await authFetch({ action: "logout" });
  } catch {
    // ignore errors, clear local state regardless
  }
}
