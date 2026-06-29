import type { MarketType } from "@txline-predict/txline-client";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { getMarketPda } from "./config";
import { decodeMarketStatus } from "./chain-status";
import idl from "./idl/predict_market.json";

const marketCoder = new BorshAccountsCoder(idl as Idl);

export interface OnChainMarketState {
  exists: boolean;
  totalDeposited: number;
  outcomePools: number[];
  outcomeCount: number;
  lockTimestamp: number | null;
  status: "open" | "locked" | "resolved" | "cancelled" | "unknown";
}

function decodeStatus(raw: unknown): OnChainMarketState["status"] {
  return decodeMarketStatus(raw);
}

/** Read on-chain pool balances for a market. */
export async function fetchOnChainMarket(
  connection: Connection,
  fixtureId: string,
  marketType: MarketType
): Promise<OnChainMarketState> {
  const [marketPda] = getMarketPda(fixtureId, marketType);
  let info;
  try {
    info = await connection.getAccountInfo(marketPda);
  } catch {
    return {
      exists: false,
      totalDeposited: 0,
      outcomePools: [],
      outcomeCount: 0,
      lockTimestamp: null,
      status: "unknown",
    };
  }
  if (!info) {
    return {
      exists: false,
      totalDeposited: 0,
      outcomePools: [],
      outcomeCount: 0,
      lockTimestamp: null,
      status: "unknown",
    };
  }

  try {
    const account = marketCoder.decode("Market", info.data) as {
      outcomePools?: number[];
      outcome_pools?: number[];
      outcomeCount?: number;
      outcome_count?: number;
      totalDeposited?: number | { toNumber(): number };
      total_deposited?: number | { toNumber(): number };
      lockTimestamp?: number | { toNumber(): number };
      lock_timestamp?: number | { toNumber(): number };
      status: unknown;
    };
    const outcomeCount = Number(account.outcomeCount ?? account.outcome_count);
    const rawPools = account.outcomePools ?? account.outcome_pools ?? [];
    const pools = rawPools.slice(0, outcomeCount).map(Number);
    const rawTotal = account.totalDeposited ?? account.total_deposited ?? 0;
    const totalDeposited =
      typeof rawTotal === "object" ? rawTotal.toNumber() : Number(rawTotal);
    const rawLock = account.lockTimestamp ?? account.lock_timestamp;
    const lockTimestamp =
      rawLock == null
        ? null
        : typeof rawLock === "object"
          ? rawLock.toNumber()
          : Number(rawLock);

    return {
      exists: true,
      totalDeposited,
      outcomePools: pools,
      outcomeCount,
      lockTimestamp,
      status: decodeStatus(account.status),
    };
  } catch {
    return {
      exists: false,
      totalDeposited: 0,
      outcomePools: [],
      outcomeCount: 0,
      lockTimestamp: null,
      status: "unknown",
    };
  }
}
