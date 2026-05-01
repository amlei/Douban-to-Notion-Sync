import type { UserProfile, AuthTokens } from "../types";

const AUTH_KEY = "auth";

interface StoredAuth {
  access_token: string;
  user: UserProfile;
  expires_at: number;
}

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const { exp } = JSON.parse(atob(payload));
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export function getAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const auth: StoredAuth = JSON.parse(raw);
    if (auth.expires_at && auth.expires_at * 1000 < Date.now()) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return auth;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

export function saveAuth(tokens: AuthTokens): void {
  const expires_at = decodeJwtExp(tokens.access_token);
  const auth: StoredAuth = {
    access_token: tokens.access_token,
    user: tokens.user,
    expires_at: expires_at ?? 0,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  localStorage.clear();
}

let _onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  _onUnauthorized = cb;
}

export function authedFetch(input: string, init?: RequestInit): Promise<Response> {
  const auth = getAuth();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (auth) headers["Authorization"] = `Bearer ${auth.access_token}`;
  const promise = fetch(input, { ...init, headers });
  promise.then((res) => {
    if (res.status === 401) {
      clearAuth();
      _onUnauthorized?.();
    }
  });
  return promise;
}

async function authFetch(body: Record<string, unknown>, authed = false): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authed) {
    const auth = getAuth();
    if (auth) headers["Authorization"] = `Bearer ${auth.access_token}`;
  }
  const res = await fetch("/api/auth", { method: "POST", headers, body: JSON.stringify(body) });
  if (authed && res.status === 401) {
    clearAuth();
    _onUnauthorized?.();
  }
  return res;
}

async function parseError(res: Response): Promise<never> {
  const data = await res.json();
  throw new Error(Array.isArray(data.detail) ? data.detail.join(", ") : data.detail ?? "请求失败");
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
): Promise<AuthTokens> {
  const res = await authFetch({ action: "verify", email, code, password });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await authFetch({ action: "login", email, password });
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function getMe(): Promise<UserProfile> {
  const res = await authFetch({ action: "mine" }, true);
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function updateProfile(data: {
  name?: string;
  avatar?: string;
  bio?: string;
}): Promise<UserProfile> {
  const res = await authFetch({ action: "update-profile", ...data }, true);
  if (!res.ok) throw new Error("Update failed");
  return res.json();
}

export async function changePassword(
  old_password: string,
  new_password: string,
): Promise<{ message: string }> {
  const res = await authFetch({ action: "change-password", old_password, new_password }, true);
  if (!res.ok) await parseError(res);
  return res.json();
}

export async function deleteAccount(): Promise<{ message: string }> {
  const res = await authFetch({ action: "delete" }, true);
  if (!res.ok) throw new Error("注销失败");
  return res.json();
}
