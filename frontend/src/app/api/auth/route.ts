import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cookie = req.headers.get("cookie") || "";

  const backendRes = await fetch(`${BACKEND_URL}/api/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();
  const res = NextResponse.json(data, { status: backendRes.status });

  // Set cookie from response's access_token (login, verify)
  if (typeof data.access_token === "string") {
    res.cookies.set("access_token", data.access_token, {
      path: "/",
      httpOnly: true,
      secure: false,
      maxAge: 86400,
      sameSite: "lax",
    });
  }

  // Clear cookie on logout
  if (body.action === "logout") {
    res.cookies.set("access_token", "", {
      path: "/",
      httpOnly: true,
      secure: false,
      maxAge: 0,
    });
  }

  return res;
}
