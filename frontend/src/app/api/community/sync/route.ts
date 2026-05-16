import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyHeaders } from "@/core/api/server";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") || "";

  const backendRes = await fetch(backendUrl(`/api/community/sync?platform=${platform}`), {
    method: "POST",
    headers: { ...proxyHeaders(req), "Content-Type": "application/json" },
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
