import { startGuestSession } from "./auth";
import type { TxLineClientConfig } from "./config";

/** Headers for TxLINE SSE streams (guest JWT + API token). */
export async function buildStreamHeaders(
  config: TxLineClientConfig
): Promise<HeadersInit> {
  const { token: jwt } = await startGuestSession(config.useDevnet);
  return {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": config.apiToken,
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
}

export type StreamChannel = "odds" | "scores";

export interface TxLineStreamEvent {
  type: "odds" | "score" | "status";
  message: string;
  fixtureId?: string;
  at: string;
}

/** Normalise a TxLINE `data:` JSON payload into a feed event. */
export function formatStreamPayload(
  payload: Record<string, unknown>,
  channel: StreamChannel
): TxLineStreamEvent | null {
  const fixtureId = String(payload.FixtureId ?? "");
  const at = new Date(
    Number(payload.Ts ?? Date.now())
  ).toISOString();

  if (channel === "odds") {
    const oddsType = String(payload.SuperOddsType ?? "odds");
    const params = payload.MarketParameters
      ? ` (${payload.MarketParameters})`
      : "";
    const pct = Array.isArray(payload.Pct)
      ? (payload.Pct as string[]).filter((p) => p !== "NA").join(" / ")
      : "";
    const prices = Array.isArray(payload.Prices)
      ? (payload.Prices as number[]).map((p) => (p / 1000).toFixed(2)).join(" / ")
      : "";

    let detail = pct || prices;
    if (oddsType === "1X2_PARTICIPANT_RESULT" && pct) {
      detail = `home/draw/away ${pct}%`;
    }
    if (oddsType === "OVERUNDER_PARTICIPANT_GOALS") {
      detail = `O/U${params} — ${prices || pct}`;
    }

    return {
      type: "odds",
      fixtureId,
      at,
      message: `Fixture ${fixtureId}: ${oddsType.replace(/_/g, " ")}${detail ? ` — ${detail}` : ""}`,
    };
  }

  // Scores channel payloads vary; surface key fields when present.
  const score1 = payload.Participant1Score ?? payload.HomeScore;
  const score2 = payload.Participant2Score ?? payload.AwayScore;
  if (score1 != null && score2 != null) {
    return {
      type: "score",
      fixtureId,
      at,
      message: `Fixture ${fixtureId}: score ${score1}-${score2}`,
    };
  }

  const event = payload.EventType ?? payload.eventType;
  if (event) {
    return {
      type: "score",
      fixtureId,
      at,
      message: `Fixture ${fixtureId}: ${String(event)}`,
    };
  }

  return {
    type: "score",
    fixtureId,
    at,
    message: `Fixture ${fixtureId}: scores update`,
  };
}

/** Parse one SSE chunk buffer into completed `data:` events. */
export function parseSseBuffer(
  buffer: string,
  onEvent: (data: string) => void
): string {
  const parts = buffer.split("\n");
  const remainder = parts.pop() ?? "";

  for (const line of parts) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      onEvent(trimmed.slice(5).trim());
    }
  }

  return remainder;
}
