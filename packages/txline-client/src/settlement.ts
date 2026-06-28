import { PublicKey } from "@solana/web3.js";
import {
  TXLINE_PROGRAM_DEVNET,
  TXLINE_PROGRAM_MAINNET,
  buildAuthHeaders,
  getApiBaseUrl,
  type TxLineClientConfig,
} from "./config";
import type { MarketType } from "./types";

/** TxLINE oracle program id for the active network. */
export function getTxLineProgramId(useDevnet = false): PublicKey {
  return new PublicKey(
    useDevnet ? TXLINE_PROGRAM_DEVNET : TXLINE_PROGRAM_MAINNET
  );
}

/** Epoch day for daily_scores_roots PDA (UTC days since epoch). */
export function epochDayFromTimestamp(tsMs = Date.now()): number {
  return Math.floor(tsMs / (24 * 60 * 60 * 1000));
}

export function getDailyScoresMerkleRootsPda(
  useDevnet = false,
  epochDay = epochDayFromTimestamp()
): [PublicKey, number] {
  const programId = getTxLineProgramId(useDevnet);
  const dayBuf = Buffer.alloc(2);
  dayBuf.writeUInt16LE(epochDay, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), dayBuf],
    programId
  );
}

export interface ProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export interface ScoresBatchSummary {
  fixtureId: number;
  updateStats: {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
  };
  eventsSubTreeRoot: number[];
}

export interface ScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface StatTerm {
  statToProve: ScoreStat;
  eventStatRoot: number[];
  statProof: ProofNode[];
}

export interface TraderPredicate {
  threshold: number;
  comparison: "GreaterThan" | "LessThan" | "EqualTo";
}

export interface StatValidationPayload {
  ts: number;
  fixtureSummary: ScoresBatchSummary;
  fixtureProof: ProofNode[];
  mainTreeProof: ProofNode[];
  predicate: TraderPredicate;
  statA: StatTerm;
  statB: StatTerm | null;
  op: "Add" | "Subtract" | null;
  homeScore: number;
  awayScore: number;
}

/** Soccer full-time period id in TxLINE scores encoding. */
export const FULL_TIME_PERIOD = 9;

/** Participant score stat keys (TxLINE soccer convention). */
export const HOME_SCORE_STAT_KEY = 1;
export const AWAY_SCORE_STAT_KEY = 2;

function parseProofNodes(raw: unknown): ProofNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((node) => {
    const n = node as Record<string, unknown>;
    const hashRaw = n.hash ?? n.Hash;
    const hash = Array.isArray(hashRaw)
      ? hashRaw.map(Number)
      : typeof hashRaw === "string"
        ? hexToBytes(hashRaw)
        : new Array(32).fill(0);
    return {
      hash,
      isRightSibling: Boolean(n.isRightSibling ?? n.is_right_sibling ?? false),
    };
  });
}

function hexToBytes(hex: string): number[] {
  const clean = hex.replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(parseInt(clean.slice(i, i + 2), 16));
  }
  while (out.length < 32) out.push(0);
  return out.slice(0, 32);
}

function parseStatTerm(raw: unknown): StatTerm | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const stat =
    (o.statToProve as Record<string, unknown>) ??
    (o.stat_to_prove as Record<string, unknown>);
  if (!stat) return null;
  return {
    statToProve: {
      key: Number(stat.key ?? 0),
      value: Number(stat.value ?? 0),
      period: Number(stat.period ?? FULL_TIME_PERIOD),
    },
    eventStatRoot: parseRoot(o.eventStatRoot ?? o.event_stat_root),
    statProof: parseProofNodes(o.statProof ?? o.stat_proof),
  };
}

function parseRoot(raw: unknown): number[] {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") return hexToBytes(raw);
  return new Array(32).fill(0);
}

function parseFixtureSummary(raw: unknown, fixtureId: string): ScoresBatchSummary {
  const o = (raw ?? {}) as Record<string, unknown>;
  const stats =
    (o.updateStats as Record<string, unknown>) ??
    (o.update_stats as Record<string, unknown>) ??
    {};
  return {
    fixtureId: Number(o.fixtureId ?? o.fixture_id ?? fixtureId),
    updateStats: {
      updateCount: Number(stats.updateCount ?? stats.update_count ?? 0),
      minTimestamp: Number(stats.minTimestamp ?? stats.min_timestamp ?? 0),
      maxTimestamp: Number(stats.maxTimestamp ?? stats.max_timestamp ?? 0),
    },
    eventsSubTreeRoot: parseRoot(
      o.eventsSubTreeRoot ?? o.events_sub_tree_root ?? o.root
    ),
  };
}

function parseComparison(raw: unknown): TraderPredicate["comparison"] {
  const s = String(raw ?? "GreaterThan");
  if (s.includes("Less")) return "LessThan";
  if (s.includes("Equal")) return "EqualTo";
  return "GreaterThan";
}

/** Map API stat-validation response into on-chain settle_market args. */
export function mapStatValidationResponse(
  data: unknown,
  fixtureId: string,
  homeScore: number,
  awayScore: number
): StatValidationPayload {
  const o = (data ?? {}) as Record<string, unknown>;
  const predicateRaw =
    (o.predicate as Record<string, unknown>) ?? { threshold: 0, comparison: "GreaterThan" };

  return {
    ts: Number(o.ts ?? o.timestamp ?? Date.now()),
    fixtureSummary: parseFixtureSummary(o.fixtureSummary ?? o.fixture_summary, fixtureId),
    fixtureProof: parseProofNodes(o.fixtureProof ?? o.fixture_proof),
    mainTreeProof: parseProofNodes(o.mainTreeProof ?? o.main_tree_proof),
    predicate: {
      threshold: Number(predicateRaw.threshold ?? 0),
      comparison: parseComparison(predicateRaw.comparison),
    },
    statA: parseStatTerm(o.statA ?? o.stat_a) ?? {
      statToProve: {
        key: HOME_SCORE_STAT_KEY,
        value: homeScore,
        period: FULL_TIME_PERIOD,
      },
      eventStatRoot: new Array(32).fill(0),
      statProof: [],
    },
    statB: parseStatTerm(o.statB ?? o.stat_b),
    op: (o.op as StatValidationPayload["op"]) ?? null,
    homeScore,
    awayScore,
  };
}

/** Fetch TxLINE stat-validation proof for a scores record. */
export async function fetchStatValidation(
  config: TxLineClientConfig,
  fixtureId: string,
  seq: number,
  statKey: number
): Promise<unknown> {
  const base = getApiBaseUrl(config.useDevnet);
  const url = new URL(`${base}/api/scores/stat-validation`);
  url.searchParams.set("fixtureId", fixtureId);
  url.searchParams.set("seq", String(seq));
  url.searchParams.set("statKey", String(statKey));

  const res = await fetch(url.toString(), {
    headers: await buildAuthHeaders(config),
  });
  if (!res.ok) {
    throw new Error(`Stat validation failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Derive winning outcome index from final scores. */
export function resolveWinningOutcomeIndex(
  marketType: MarketType,
  homeScore: number,
  awayScore: number
): number {
  if (marketType === "match_winner") {
    if (homeScore > awayScore) return 0;
    if (homeScore === awayScore) return 1;
    return 2;
  }
  if (marketType === "total_goals") {
    return homeScore + awayScore > 2 ? 0 : 1;
  }
  return homeScore > 0 && awayScore > 0 ? 0 : 1;
}

export function validationToMerkleProof(
  payload: StatValidationPayload,
  fixtureId: string
): {
  fixtureId: string;
  root: string;
  proof: string[];
  leaf: string;
  validatedAt: string;
} {
  const rootBytes = payload.fixtureSummary.eventsSubTreeRoot;
  const rootHex = rootBytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const proofHex = payload.fixtureProof.map((node) =>
    node.hash.map((b) => b.toString(16).padStart(2, "0")).join("")
  );
  const leafHex = payload.statA.statProof[0]?.hash
    ? payload.statA.statProof[0].hash
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    : rootHex;

  return {
    fixtureId,
    root: rootHex,
    proof: proofHex,
    leaf: leafHex,
    validatedAt: new Date(payload.ts).toISOString(),
  };
}
