import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.INTERNAL_BACKEND_URL || "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "all";

  const backendRes = await fetch(
    `${BACKEND_URL}/api/community/data?platform=${platform}`,
    {
      headers: { Cookie: cookie },
    },
  );

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
