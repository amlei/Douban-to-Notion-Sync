import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyHeaders } from "@/core/api/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "all";

  const backendRes = await fetch(backendUrl(`/api/community/data?platform=${platform}`), {
    headers: proxyHeaders(req),
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
