import type { MarketType, PredictionMarket } from "./types";

export interface OddsSnapshotPoint {
  fixtureId: string;
  marketType: MarketType;
  outcomeId: string;
  outcomeLabel: string;
  implied: number;
  capturedAt: string;
}

export interface SharpMovementSignal {
  id: string;
  fixtureId: string;
  marketType: MarketType;
  outcomeId: string;
  outcomeLabel: string;
  homeTeam: string;
  awayTeam: string;
  previousImplied: number;
  currentImplied: number;
  delta: number;
  direction: "up" | "down";
  severity: "minor" | "sharp" | "major";
  detectedAt: string;
}

/** Minimum implied-probability shift to flag (3 percentage points). */
export const DEFAULT_SHARP_THRESHOLD = 0.03;

function severityForDelta(absDelta: number): SharpMovementSignal["severity"] {
  if (absDelta >= 0.08) return "major";
  if (absDelta >= 0.05) return "sharp";
  return "minor";
}

export function snapshotsFromMarkets(
  markets: PredictionMarket[],
  capturedAt = new Date().toISOString()
): OddsSnapshotPoint[] {
  const points: OddsSnapshotPoint[] = [];
  for (const market of markets) {
    for (const outcome of market.outcomes) {
      if (outcome.impliedProbability == null) continue;
      points.push({
        fixtureId: market.fixtureId,
        marketType: market.type,
        outcomeId: outcome.id,
        outcomeLabel: outcome.label,
        implied: outcome.impliedProbability,
        capturedAt,
      });
    }
  }
  return points;
}

function snapshotKey(p: Pick<OddsSnapshotPoint, "fixtureId" | "marketType" | "outcomeId">) {
  return `${p.fixtureId}:${p.marketType}:${p.outcomeId}`;
}

/** Compare two odds snapshots and return significant line moves. */
export function detectSharpMovements(
  previous: OddsSnapshotPoint[],
  current: OddsSnapshotPoint[],
  markets: PredictionMarket[],
  threshold = DEFAULT_SHARP_THRESHOLD
): SharpMovementSignal[] {
  const prevMap = new Map(previous.map((p) => [snapshotKey(p), p]));
  const marketMap = new Map(
    markets.map((m) => [`${m.fixtureId}:${m.type}`, m])
  );
  const signals: SharpMovementSignal[] = [];

  for (const point of current) {
    const prev = prevMap.get(snapshotKey(point));
    if (!prev) continue;

    const delta = point.implied - prev.implied;
    const absDelta = Math.abs(delta);
    if (absDelta < threshold) continue;

    const market = marketMap.get(`${point.fixtureId}:${point.marketType}`);
    signals.push({
      id: `${snapshotKey(point)}:${point.capturedAt}`,
      fixtureId: point.fixtureId,
      marketType: point.marketType,
      outcomeId: point.outcomeId,
      outcomeLabel: point.outcomeLabel,
      homeTeam: market?.homeTeam ?? "Home",
      awayTeam: market?.awayTeam ?? "Away",
      previousImplied: prev.implied,
      currentImplied: point.implied,
      delta,
      direction: delta > 0 ? "up" : "down",
      severity: severityForDelta(absDelta),
      detectedAt: point.capturedAt,
    });
  }

  return signals.sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
  );
}
