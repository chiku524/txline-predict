import { NextResponse } from "next/server";
import {
  getSharpMovementState,
  pollSharpMovements,
} from "@/lib/agents/sharp-monitor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Autonomous odds monitor — polls TxLINE every ~60s when called. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shouldPoll = searchParams.get("poll") !== "false";

  try {
    const state = getSharpMovementState();
    const lastPollMs = state.lastPollAt
      ? Date.parse(state.lastPollAt)
      : 0;
    const stale = Date.now() - lastPollMs >= 60_000;

    const result =
      shouldPoll && stale ? await pollSharpMovements() : {
        ...state,
        marketsTracked: state.signals.length > 0 ? undefined : 0,
        newSignals: 0,
      };

    return NextResponse.json({
      agent: "sharp-movement-detector",
      description:
        "Monitors TxLINE odds snapshots and flags significant implied-probability shifts.",
      threshold: "3% implied probability",
      pollIntervalSec: 60,
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Monitor poll failed",
        signals: getSharpMovementState().signals,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const result = await pollSharpMovements();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Poll failed" },
      { status: 500 }
    );
  }
}
