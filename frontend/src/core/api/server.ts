import { getConfig } from "@/core/lib/config";

export function backendUrl(path: string): string {
  return `${getConfig().backend_url}${path}`;
}

export function proxyHeaders(req: Request, extra?: Record<string, string>): Record<string, string> {
  const cookie = req.headers.get("cookie") || "";
  const headers: Record<string, string> = { ...extra };
  if (cookie) headers.Cookie = cookie;
  return headers;
}
