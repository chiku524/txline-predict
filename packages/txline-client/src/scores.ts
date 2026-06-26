import type { TxLineFixture } from "./types";

/** Raw score/fixture row from TxLINE `/api/scores/snapshot`. */
export interface TxLineRawScore {
  FixtureId?: number;
  Participant1Score?: number;
  Participant2Score?: number;
  StartTime?: number;
  EventType?: string;
  Phase?: string;
}

function isFinished(eventType?: string): boolean {
  const e = (eventType ?? "").toLowerCase();
  return e.includes("full") || e.includes("finished") || e.includes("ft");
}

/** Merge scores snapshot into fixture list (status, scores, phase). */
export function mergeScoresIntoFixtures(
  fixtures: TxLineFixture[],
  rawScores: unknown
): TxLineFixture[] {
  if (!Array.isArray(rawScores) || rawScores.length === 0) return fixtures;

  const byId = new Map<string, TxLineRawScore>();
  for (const row of rawScores) {
    const r = row as TxLineRawScore;
    const id = String(r.FixtureId ?? "");
    if (id) byId.set(id, r);
  }

  return fixtures.map((f) => {
    const score = byId.get(f.fixtureId);
    if (!score) return f;

    const homeScore = Number(score.Participant1Score ?? f.homeScore ?? 0);
    const awayScore = Number(score.Participant2Score ?? f.awayScore ?? 0);
    const kickoff = new Date(f.kickoffUtc).getTime();
    const now = Date.now();

    let status = f.status;
    if (isFinished(score.EventType)) {
      status = "finished";
    } else if (kickoff <= now) {
      status = "live";
    }

    return {
      ...f,
      homeScore,
      awayScore,
      status,
      phase: score.Phase ?? f.phase,
    };
  });
}
