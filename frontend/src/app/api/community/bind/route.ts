import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";
  const platform = searchParams.get("platform") || "";
  const body = await req.text();

  const backendRes = await fetch(
    `${BACKEND_URL}/api/community/bind?action=${action}&platform=${platform}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body || undefined,
    },
  );

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
