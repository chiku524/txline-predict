import { NextResponse } from "next/server";
import { getMarkets } from "@/lib/markets";
import { isDemoMode } from "@/lib/txline";

export const revalidate = 60;

export async function GET() {
  const markets = await getMarkets();
  return NextResponse.json(
    {
      markets,
      source: isDemoMode() ? "demo" : "txline",
      count: markets.length,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  );
}
