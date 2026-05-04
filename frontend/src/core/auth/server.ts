import type { AuthResult, UserProfile } from "./types";

export async function getServerSideUser(accessToken?: string): Promise<AuthResult> {
  if (!accessToken) return { status: "unauthenticated" };

  try {
    const backendURL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";
    const res = await fetch(`${backendURL}/api/auth`, {
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
