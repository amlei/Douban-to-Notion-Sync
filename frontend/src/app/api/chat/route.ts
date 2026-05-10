import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const action = req.nextUrl.searchParams.get("action");
  const qs = req.nextUrl.search ? req.nextUrl.search : "";

  const body = await req.text();

  const headers: Record<string, string> = {
    Cookie: cookie,
  };
  if (body) {
    headers["Content-Type"] = req.headers.get("content-type") || "application/json";
  }

  const backendRes = await fetch(`${BACKEND_URL}/api/chat${qs}`, {
    method: "POST",
    headers,
    body: body || undefined,
  });

  // Non-streaming actions: return JSON
  if (action === "list" || action === "messages" || action === "delete" || action === "rename" || action === "batch-delete") {
    const text = await backendRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: `Backend error: ${backendRes.status}` },
        { status: backendRes.status },
      );
    }
    return NextResponse.json(data, { status: backendRes.status });
  }

  // Default: forward streaming response
  const resHeaders = new Headers();
  resHeaders.set("Content-Type", "text/event-stream");
  resHeaders.set("Cache-Control", "no-cache");
  const sessionId = backendRes.headers.get("x-session-id");
  if (sessionId) {
    resHeaders.set("x-session-id", sessionId);
  }

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: resHeaders,
  });
}
