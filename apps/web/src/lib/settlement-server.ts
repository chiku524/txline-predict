import type { PredictionMarket, TxLineFixture } from "@txline-predict/txline-client";
import {
  HOME_SCORE_STAT_KEY,
  fetchStatValidation,
  mapStatValidationResponse,
  resolveWinningOutcomeIndex,
  validationToMerkleProof,
  type StatValidationPayload,
} from "@txline-predict/txline-client";
import { isDemoMode } from "./txline";

const apiToken = process.env.TXLINE_API_TOKEN ?? "";

export interface SettlementPlan {
  winningOutcomeIndex: number;
  winningOutcomeId: string;
  homeScore: number;
  awayScore: number;
  payload: StatValidationPayload;
  proof: ReturnType<typeof validationToMerkleProof>;
  useVerifiedProof: boolean;
}

function findFixture(
  fixtures: TxLineFixture[],
  fixtureId: string
): TxLineFixture | undefined {
  return fixtures.find((f) => f.fixtureId === fixtureId);
}

/** Build settlement plan for a finished market (live TxLINE or demo fallback). */
export async function buildSettlementPlan(
  market: PredictionMarket,
  fixtures: TxLineFixture[],
  scoreSeq = 1
): Promise<SettlementPlan | null> {
  const fixture = findFixture(fixtures, market.fixtureId);
  if (!fixture || fixture.status !== "finished") return null;

  const homeScore = fixture.homeScore ?? 0;
  const awayScore = fixture.awayScore ?? 0;
  const winningOutcomeIndex = resolveWinningOutcomeIndex(
    market.type,
    homeScore,
    awayScore
  );
  const winningOutcomeId = market.outcomes[winningOutcomeIndex]?.id;
  if (!winningOutcomeId) return null;

  if (isDemoMode() || !apiToken) {
    const payload: StatValidationPayload = {
      ts: Date.now(),
      fixtureSummary: {
        fixtureId: Number(market.fixtureId.replace(/\D/g, "")) || 0,
        updateStats: { updateCount: 1, minTimestamp: Date.now(), maxTimestamp: Date.now() },
        eventsSubTreeRoot: new Array(32).fill(0),
      },
      fixtureProof: [],
      mainTreeProof: [],
      predicate: { threshold: 0, comparison: "GreaterThan" },
      statA: {
        statToProve: { key: HOME_SCORE_STAT_KEY, value: homeScore, period: 9 },
        eventStatRoot: new Array(32).fill(0),
        statProof: [],
      },
      statB: null,
      op: null,
      homeScore,
      awayScore,
    };

    return {
      winningOutcomeIndex,
      winningOutcomeId,
      homeScore,
      awayScore,
      payload,
      proof: validationToMerkleProof(payload, market.fixtureId),
      useVerifiedProof: false,
    };
  }

  try {
    const raw = await fetchStatValidation(
      { apiToken },
      market.fixtureId,
      scoreSeq,
      HOME_SCORE_STAT_KEY
    );
    const payload = mapStatValidationResponse(
      raw,
      market.fixtureId,
      homeScore,
      awayScore
    );
    payload.homeScore = homeScore;
    payload.awayScore = awayScore;

    return {
      winningOutcomeIndex,
      winningOutcomeId,
      homeScore,
      awayScore,
      payload,
      proof: validationToMerkleProof(payload, market.fixtureId),
      useVerifiedProof: payload.fixtureProof.length > 0,
    };
  } catch {
    return null;
  }
}
