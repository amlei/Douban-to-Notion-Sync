import { NextRequest, NextResponse } from "next/server";
import { backendUrl, proxyHeaders } from "@/core/api/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Forward all query params to the backend
  const qs = searchParams.toString();
  const backendRes = await fetch(backendUrl(`/api/community/data${qs ? `?${qs}` : ""}`), {
    headers: proxyHeaders(req),
  });

  const data = await backendRes.json();
  return NextResponse.json(data, { status: backendRes.status });
}
