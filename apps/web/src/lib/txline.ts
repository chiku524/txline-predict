import type { TxLineFixture } from "@txline-predict/txline-client";
import { fetchOddsSnapshot, fetchScoresSnapshot } from "@txline-predict/txline-client";
import { DEMO_FIXTURES } from "./demo-data";

const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true";
const apiToken = process.env.TXLINE_API_TOKEN ?? "";

function mapRawToFixtures(raw: unknown): TxLineFixture[] {
  if (!Array.isArray(raw)) return DEMO_FIXTURES;
  return raw.slice(0, 20).map((item, i) => {
    const r = item as Record<string, unknown>;
    return {
      fixtureId: String(r.fixtureId ?? r.id ?? `fixture-${i}`),
      competitionId: Number(r.competitionId ?? 500001),
      competitionName: String(r.competitionName ?? "World Cup"),
      homeTeam: String(r.homeTeam ?? r.home ?? "Home"),
      awayTeam: String(r.awayTeam ?? r.away ?? "Away"),
      kickoffUtc: String(r.kickoffUtc ?? r.startTime ?? new Date().toISOString()),
      status: (r.status as TxLineFixture["status"]) ?? "scheduled",
      homeScore: Number(r.homeScore ?? 0),
      awayScore: Number(r.awayScore ?? 0),
    };
  });
}

export async function getFixtures(): Promise<TxLineFixture[]> {
  if (useDemo || !apiToken) return DEMO_FIXTURES;
  try {
    const scores = await fetchScoresSnapshot({ apiToken });
    return mapRawToFixtures(scores);
  } catch {
    try {
      const odds = await fetchOddsSnapshot({ apiToken });
      return mapRawToFixtures(odds);
    } catch {
      return DEMO_FIXTURES;
    }
  }
}

export function isDemoMode(): boolean {
  return useDemo || !apiToken;
}
