import type { MarketType, PredictionMarket } from "./types";
import type { SharpMovementSignal } from "./sharp-movements";

export interface ArenaBetDecision {
  agentId: "momentum" | "contrarian";
  fixtureId: string;
  marketType: MarketType;
  outcomeIndex: number;
  outcomeId: string;
  outcomeLabel: string;
  reason: string;
  stakeLamports: number;
}

export const ARENA_STAKE_LAMPORTS = 1_000_000;

function outcomeIndexForId(
  market: PredictionMarket,
  outcomeId: string
): number {
  const idx = market.outcomes.findIndex((o) => o.id === outcomeId);
  return idx >= 0 ? idx : 0;
}

/** Follow the side that gained implied probability (sharp money). */
export function momentumDecision(
  signal: SharpMovementSignal,
  market: PredictionMarket,
  stakeLamports = ARENA_STAKE_LAMPORTS
): ArenaBetDecision {
  const outcomeIndex = outcomeIndexForId(market, signal.outcomeId);
  return {
    agentId: "momentum",
    fixtureId: signal.fixtureId,
    marketType: signal.marketType,
    outcomeIndex,
    outcomeId: signal.outcomeId,
    outcomeLabel: signal.outcomeLabel,
    reason: `Follows +${(signal.delta * 100).toFixed(1)}pt move on ${signal.outcomeLabel}`,
    stakeLamports,
  };
}

/** Fade the move — bet the strongest alternative outcome. */
export function contrarianDecision(
  signal: SharpMovementSignal,
  market: PredictionMarket,
  stakeLamports = ARENA_STAKE_LAMPORTS
): ArenaBetDecision {
  const alternatives = market.outcomes.filter((o) => o.id !== signal.outcomeId);
  const pick = alternatives.reduce((best, o) =>
    (o.impliedProbability ?? 0) > (best.impliedProbability ?? 0) ? o : best
  );
  const outcomeIndex = outcomeIndexForId(market, pick.id);

  return {
    agentId: "contrarian",
    fixtureId: signal.fixtureId,
    marketType: signal.marketType,
    outcomeIndex,
    outcomeId: pick.id,
    outcomeLabel: pick.label,
    reason: `Fades ${signal.outcomeLabel} move — backs ${pick.label} instead`,
    stakeLamports,
  };
}

export function decisionsForSignal(
  signal: SharpMovementSignal,
  market: PredictionMarket
): ArenaBetDecision[] {
  return [
    momentumDecision(signal, market),
    contrarianDecision(signal, market),
  ];
}
