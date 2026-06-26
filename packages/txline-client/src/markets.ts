import type { PredictionMarket, TxLineFixture } from "./types";
import { parseMatchWinnerOdds, parseTotalGoalsOdds, type TxLineRawOdds } from "./odds";

const BASE_POOL_LAMPORTS = 1_000_000_000;

function marketStatus(fixture: TxLineFixture): PredictionMarket["status"] {
  const kickoff = new Date(fixture.kickoffUtc).getTime();
  if (fixture.status === "finished") return "resolved";
  if (Date.now() >= kickoff) return "locked";
  return "open";
}

function allocatePool(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => Math.round((w / sum) * BASE_POOL_LAMPORTS));
}

export function buildMarketsForFixture(
  fixture: TxLineFixture,
  odds: TxLineRawOdds[]
): PredictionMarket[] {
  const markets: PredictionMarket[] = [];
  const status = marketStatus(fixture);

  const matchOdds = parseMatchWinnerOdds(odds);
  if (matchOdds) {
    const weights = [matchOdds.homeImplied, matchOdds.drawImplied, matchOdds.awayImplied];
    const [homePool, drawPool, awayPool] = allocatePool(weights);
    markets.push({
      id: `mkt-${fixture.fixtureId}-1x2`,
      fixtureId: fixture.fixtureId,
      type: "match_winner",
      title: "Match Winner",
      competitionId: fixture.competitionId,
      competitionName: fixture.competitionName,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      kickoffUtc: fixture.kickoffUtc,
      status,
      totalPoolLamports: homePool + drawPool + awayPool,
      outcomes: [
        {
          id: "home",
          label: fixture.homeTeam,
          impliedProbability: matchOdds.homeImplied,
          poolLamports: homePool,
        },
        {
          id: "draw",
          label: "Draw",
          impliedProbability: matchOdds.drawImplied,
          poolLamports: drawPool,
        },
        {
          id: "away",
          label: fixture.awayTeam,
          impliedProbability: matchOdds.awayImplied,
          poolLamports: awayPool,
        },
      ],
    });
  }

  const totalOdds = parseTotalGoalsOdds(odds, 2.5);
  if (totalOdds) {
    const [overPool, underPool] = allocatePool([
      totalOdds.overImplied,
      totalOdds.underImplied,
    ]);
    markets.push({
      id: `mkt-${fixture.fixtureId}-ou25`,
      fixtureId: fixture.fixtureId,
      type: "total_goals",
      title: "Total Goals O/U 2.5",
      competitionId: fixture.competitionId,
      competitionName: fixture.competitionName,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      kickoffUtc: fixture.kickoffUtc,
      status,
      totalPoolLamports: overPool + underPool,
      outcomes: [
        {
          id: "over",
          label: "Over 2.5",
          impliedProbability: totalOdds.overImplied,
          poolLamports: overPool,
        },
        {
          id: "under",
          label: "Under 2.5",
          impliedProbability: totalOdds.underImplied,
          poolLamports: underPool,
        },
      ],
    });
  }

  return markets;
}

export function buildMarketsFromFixtures(
  fixtures: TxLineFixture[],
  oddsByFixture: Map<string, TxLineRawOdds[]>
): PredictionMarket[] {
  return fixtures.flatMap((fixture) => {
    const odds = oddsByFixture.get(fixture.fixtureId) ?? [];
    return buildMarketsForFixture(fixture, odds);
  });
}
