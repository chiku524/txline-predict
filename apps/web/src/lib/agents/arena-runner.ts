import type {
  ArenaBetDecision,
  PredictionMarket,
  SharpMovementSignal,
} from "@txline-predict/txline-client";
import {
  buildMarketsFromFixtures,
  decisionsForSignal,
  fetchFixturesSnapshot,
  fetchOddsForFixtures,
  mapRawFixtures,
} from "@txline-predict/txline-client";
import { Connection, Keypair } from "@solana/web3.js";
import {
  assertBetPreflight,
  buildBetTransaction,
  sendBetTransaction,
} from "@/lib/solana/bet-transaction";
import { getPredictMarketProgram } from "@/lib/solana/program";
import { keypairToAnchorWallet } from "@/lib/solana/server-wallet";
import { loadOrCreateAgentKeypair, type AgentId } from "./agent-wallets";
import { pollSharpMovements } from "./sharp-monitor";

const apiToken = process.env.TXLINE_API_TOKEN ?? "";
const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

export interface ArenaBetRecord {
  id: string;
  agentId: AgentId;
  fixtureId: string;
  marketType: string;
  outcomeLabel: string;
  stakeLamports: number;
  reason: string;
  txSig: string | null;
  ok: boolean;
  error: string | null;
  placedAt: string;
}

interface ArenaState {
  bets: ArenaBetRecord[];
  lastRunAt: string | null;
  runCount: number;
  lastError: string | null;
  processedSignalIds: string[];
}

const globalStore = globalThis as typeof globalThis & {
  __arenaState?: ArenaState;
};

function store(): ArenaState {
  if (!globalStore.__arenaState) {
    globalStore.__arenaState = {
      bets: [],
      lastRunAt: null,
      runCount: 0,
      lastError: null,
      processedSignalIds: [],
    };
  }
  return globalStore.__arenaState;
}

async function loadOpenMarkets(): Promise<PredictionMarket[]> {
  const raw = await fetchFixturesSnapshot({ apiToken });
  const fixtures = mapRawFixtures(raw);
  const odds = await fetchOddsForFixtures(
    { apiToken },
    fixtures.map((f) => f.fixtureId)
  );
  return buildMarketsFromFixtures(fixtures, odds).filter((m) => m.status === "open");
}

async function placeAgentBet(
  connection: Connection,
  keypair: Keypair,
  market: PredictionMarket,
  decision: ArenaBetDecision
): Promise<{ ok: boolean; sig?: string; error?: string }> {
  try {
    await assertBetPreflight(
      connection,
      market.fixtureId,
      market.type,
      market.kickoffUtc,
      decision.stakeLamports,
      keypair.publicKey,
      network
    );

    const wallet = keypairToAnchorWallet(keypair);
    const program = getPredictMarketProgram(connection, wallet);
    const tx = await buildBetTransaction({
      program,
      connection,
      wallet: keypair.publicKey,
      fixtureId: market.fixtureId,
      marketType: market.type,
      kickoffUtc: market.kickoffUtc,
      outcomeCount: market.outcomes.length,
      outcomeIndex: decision.outcomeIndex,
      stakeLamports: decision.stakeLamports,
      network,
    });
    const sig = await sendBetTransaction(connection, tx, wallet);
    return { ok: true, sig };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runArenaCycle(
  connection: Connection,
  rpcUrl: string
): Promise<{
  bets: ArenaBetRecord[];
  lastRunAt: string | null;
  runCount: number;
  newBets: number;
  signalsProcessed: number;
  agentPubkeys: Record<AgentId, string>;
  lastError: string | null;
}> {
  if (!apiToken) {
    throw new Error("TXLINE_API_TOKEN required for arena");
  }

  const state = store();
  const conn = connection ?? new Connection(rpcUrl, "confirmed");

  const poll = await pollSharpMovements();
  const markets = await loadOpenMarkets();
  const marketMap = new Map(
    markets.map((m) => [`${m.fixtureId}:${m.type}`, m])
  );

  const freshSignals = poll.signals.filter(
    (s) => !state.processedSignalIds.includes(s.id)
  );

  const newRecords: ArenaBetRecord[] = [];

  for (const signal of freshSignals.slice(0, 3)) {
    const market = marketMap.get(`${signal.fixtureId}:${signal.marketType}`);
    if (!market) continue;

    state.processedSignalIds.push(signal.id);
    const decisions = decisionsForSignal(signal, market);

    for (const decision of decisions) {
      const keypair = loadOrCreateAgentKeypair(decision.agentId);
      const result = await placeAgentBet(conn, keypair, market, decision);
      newRecords.push({
        id: `${decision.agentId}-${signal.id}-${Date.now()}`,
        agentId: decision.agentId,
        fixtureId: market.fixtureId,
        marketType: market.type,
        outcomeLabel: decision.outcomeLabel,
        stakeLamports: decision.stakeLamports,
        reason: decision.reason,
        txSig: result.sig ?? null,
        ok: result.ok,
        error: result.error ?? null,
        placedAt: new Date().toISOString(),
      });
    }
  }

  if (newRecords.length > 0) {
    state.bets = [...newRecords, ...state.bets].slice(0, 50);
  }

  state.lastRunAt = new Date().toISOString();
  state.runCount += 1;
  state.lastError = newRecords.find((b) => !b.ok)?.error ?? null;

  return {
    bets: state.bets,
    lastRunAt: state.lastRunAt,
    runCount: state.runCount,
    newBets: newRecords.length,
    signalsProcessed: freshSignals.length,
    agentPubkeys: {
      momentum: loadOrCreateAgentKeypair("momentum").publicKey.toBase58(),
      contrarian: loadOrCreateAgentKeypair("contrarian").publicKey.toBase58(),
    },
    lastError: state.lastError,
  };
}

export function getArenaState() {
  const state = store();
  return {
    bets: state.bets,
    lastRunAt: state.lastRunAt,
    runCount: state.runCount,
    lastError: state.lastError,
    agentPubkeys: {
      momentum: loadOrCreateAgentKeypair("momentum").publicKey.toBase58(),
      contrarian: loadOrCreateAgentKeypair("contrarian").publicKey.toBase58(),
    },
  };
}

export function arenaScoreboard(bets: ArenaBetRecord[]) {
  const score = { momentum: 0, contrarian: 0 };
  for (const bet of bets) {
    if (bet.ok) score[bet.agentId] += bet.stakeLamports;
  }
  return score;
}
