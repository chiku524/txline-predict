import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import {
  arenaScoreboard,
  getArenaState,
  runArenaCycle,
} from "@/lib/agents/arena-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function rpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_RPC_URL ??
    "https://api.devnet.solana.com"
  );
}

export async function GET() {
  const state = getArenaState();
  return NextResponse.json({
    agent: "agent-vs-agent-arena",
    description:
      "Momentum agent follows sharp TxLINE moves; contrarian agent fades them. Bets settle in on-chain parimutuel pools.",
    scoreboard: arenaScoreboard(state.bets),
    ...state,
  });
}

export async function POST() {
  try {
    const connection = new Connection(rpcUrl(), "confirmed");
    const result = await runArenaCycle(connection, rpcUrl());
    return NextResponse.json({
      ...result,
      scoreboard: arenaScoreboard(result.bets),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Arena run failed" },
      { status: 500 }
    );
  }
}
