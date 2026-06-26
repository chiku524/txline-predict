/** Normalised TxLINE fixture / match record (subset used by txline-predict). */
export interface TxLineFixture {
  fixtureId: string;
  competitionId: number;
  competitionName?: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
  homeScore?: number;
  awayScore?: number;
  phase?: string;
}

export interface TxLineOddsSnapshot {
  fixtureId: string;
  market: string;
  homeImplied?: number;
  drawImplied?: number;
  awayImplied?: number;
  updatedAt: string;
}

export interface TxLineScoreEvent {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  eventType: string;
  minute?: number;
  player?: string;
  timestamp: string;
}

export interface TxLineMerkleProof {
  fixtureId: string;
  root: string;
  proof: string[];
  leaf: string;
  validatedAt?: string;
}

export type MarketType = "match_winner" | "total_goals" | "both_teams_score";

export interface PredictionMarket {
  id: string;
  fixtureId: string;
  type: MarketType;
  title: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  status: "open" | "locked" | "resolved" | "cancelled";
  outcomes: MarketOutcome[];
  totalPoolLamports: number;
  resolvedOutcomeId?: string;
  proof?: TxLineMerkleProof;
}

export interface MarketOutcome {
  id: string;
  label: string;
  impliedProbability?: number;
  poolLamports: number;
}
