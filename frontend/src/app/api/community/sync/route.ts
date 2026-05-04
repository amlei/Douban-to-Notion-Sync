import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "";

  const backendRes = await fetch(
    `${BACKEND_URL}/api/community/sync?platform=${platform}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
    },
  );

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
