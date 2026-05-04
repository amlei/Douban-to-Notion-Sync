import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": req.headers.get("content-type") || "application/json",
      Cookie: cookie,
    },
    body,
  });

  // Stream response back
  const contentType = backendRes.headers.get("content-type") || "text/plain";
  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: { "Content-Type": contentType },
  });
}
