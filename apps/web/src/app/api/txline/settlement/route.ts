import { NextResponse } from "next/server";
import type { MarketType } from "@txline-predict/txline-client";
import { getMarkets } from "@/lib/markets";
import { buildSettlementPlan } from "@/lib/settlement-server";
import { getFixtures, isDemoMode } from "@/lib/txline";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get("fixtureId");
  const marketType = searchParams.get("marketType") as MarketType | null;
  const scoreSeq = Number(searchParams.get("seq") ?? "1");

  if (!fixtureId || !marketType) {
    return NextResponse.json(
      { error: "fixtureId and marketType are required" },
      { status: 400 }
    );
  }

  const [fixtures, markets] = await Promise.all([getFixtures(), getMarkets()]);
  const market = markets.find(
    (m) => m.fixtureId === fixtureId && m.type === marketType
  );
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const plan = await buildSettlementPlan(market, fixtures, scoreSeq);
  if (!plan) {
    return NextResponse.json(
      { error: "Fixture not finished or proof unavailable" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    fixtureId,
    marketType,
    winningOutcomeIndex: plan.winningOutcomeIndex,
    winningOutcomeId: plan.winningOutcomeId,
    homeScore: plan.homeScore,
    awayScore: plan.awayScore,
    payload: plan.payload,
    proof: plan.proof,
    useVerifiedProof: plan.useVerifiedProof,
    source: isDemoMode() ? "demo" : "txline",
  });
}
