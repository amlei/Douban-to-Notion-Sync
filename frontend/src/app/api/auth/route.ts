import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyHeaders } from "@/core/api/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const backendRes = await fetch(backendUrl("/api/auth"), {
    method: "POST",
    headers: { ...proxyHeaders(req), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();
  const res = NextResponse.json(data, { status: backendRes.status });

  if (typeof data.access_token === "string") {
    res.cookies.set("access_token", data.access_token, {
      path: "/",
      httpOnly: true,
      secure: false,
      maxAge: 86400,
      sameSite: "lax",
    });
  }

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
