import type { AuthResult, UserProfile } from "./types";
import { backendUrl } from "@/core/api/server";

export async function getServerSideUser(accessToken?: string): Promise<AuthResult> {
  if (!accessToken) return { status: "unauthenticated" };

  try {
    const res = await fetch(backendUrl("/api/auth"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `access_token=${accessToken}`,
      },
      body: JSON.stringify({ action: "mine" }),
    });

    if (!res.ok) return { status: "unauthenticated" };

    const user: UserProfile = await res.json();
    return { status: "authenticated", user };
  } catch {
    return { status: "gateway_unavailable" };
  }
}
