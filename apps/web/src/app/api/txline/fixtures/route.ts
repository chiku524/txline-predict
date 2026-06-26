import { NextResponse } from "next/server";
import { fetchFixturesSnapshot } from "@txline-predict/txline-client";
import { DEMO_FIXTURES } from "@/lib/demo-data";

export async function GET() {
  const apiToken = process.env.TXLINE_API_TOKEN;
  const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true" || !apiToken;

  if (useDemo) {
    return NextResponse.json({ fixtures: DEMO_FIXTURES, source: "demo" });
  }

  try {
    const data = await fetchFixturesSnapshot({ apiToken });
    return NextResponse.json({ data, source: "txline" });
  } catch (err) {
    return NextResponse.json(
      { error: String(err), fixtures: DEMO_FIXTURES, source: "fallback" },
      { status: 502 }
    );
  }
}
