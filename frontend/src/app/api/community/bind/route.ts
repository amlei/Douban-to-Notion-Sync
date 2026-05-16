import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyHeaders } from "@/core/api/server";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "";
  const platform = searchParams.get("platform") || "";
  const body = await req.text();

  const backendRes = await fetch(
    backendUrl(`/api/community/bind?action=${action}&platform=${platform}`),
    {
      method: "POST",
      headers: { ...proxyHeaders(req), "Content-Type": "application/json" },
      body: body || undefined,
    },
  );

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
