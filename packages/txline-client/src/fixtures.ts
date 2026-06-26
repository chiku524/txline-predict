import type { TxLineFixture } from "./types";

/** Raw fixture record from TxLINE `/api/fixtures/snapshot`. */
export interface TxLineRawFixture {
  Ts?: number;
  StartTime?: number;
  Competition?: string;
  CompetitionId?: number;
  FixtureId?: number;
  Participant1?: string;
  Participant2?: string;
  Participant1IsHome?: boolean;
  Participant1Score?: number;
  Participant2Score?: number;
}

export function mapRawFixture(raw: TxLineRawFixture): TxLineFixture {
  const p1 = raw.Participant1 ?? "Home";
  const p2 = raw.Participant2 ?? "Away";
  const homeFirst = raw.Participant1IsHome !== false;

  const kickoffMs = raw.StartTime ?? raw.Ts ?? Date.now();
  const kickoff = new Date(kickoffMs);
  const now = Date.now();
  let status: TxLineFixture["status"] = "scheduled";
  if (kickoffMs <= now) {
    status = "live";
  }

  return {
    fixtureId: String(raw.FixtureId ?? ""),
    competitionId: Number(raw.CompetitionId ?? 72),
    competitionName: raw.Competition ?? "World Cup",
    homeTeam: homeFirst ? p1 : p2,
    awayTeam: homeFirst ? p2 : p1,
    kickoffUtc: kickoff.toISOString(),
    status,
    homeScore: Number(raw.Participant1Score ?? 0),
    awayScore: Number(raw.Participant2Score ?? 0),
  };
}

export function mapRawFixtures(raw: unknown): TxLineFixture[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => mapRawFixture(item as TxLineRawFixture))
    .filter((f) => f.fixtureId.length > 0);
}
