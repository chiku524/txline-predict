import type { MarketType } from "@txline-predict/txline-client";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { getMarketPda } from "./config";
import idl from "./idl/predict_market.json";

const marketCoder = new BorshAccountsCoder(idl as Idl);

export interface OnChainMarketState {
  exists: boolean;
  totalDeposited: number;
  outcomePools: number[];
  outcomeCount: number;
  status: "open" | "locked" | "resolved" | "cancelled" | "unknown";
}

function decodeStatus(raw: unknown): OnChainMarketState["status"] {
  if (!raw || typeof raw !== "object") return "unknown";
  const key = Object.keys(raw)[0];
  if (key === "open") return "open";
  if (key === "locked") return "locked";
  if (key === "resolved") return "resolved";
  if (key === "cancelled") return "cancelled";
  return "unknown";
}

/** Read on-chain pool balances for a market. */
export async function fetchOnChainMarket(
  connection: Connection,
  fixtureId: string,
  marketType: MarketType
): Promise<OnChainMarketState> {
  const [marketPda] = getMarketPda(fixtureId, marketType);
  const info = await connection.getAccountInfo(marketPda);
  if (!info) {
    return {
      exists: false,
      totalDeposited: 0,
      outcomePools: [],
      outcomeCount: 0,
      status: "unknown",
    };
  }

  try {
    const account = marketCoder.decode("Market", info.data) as {
      outcomePools: number[];
      outcomeCount: number;
      totalDeposited: number | { toNumber(): number };
      status: unknown;
    };
    const outcomeCount = Number(account.outcomeCount);
    const pools = account.outcomePools.slice(0, outcomeCount).map(Number);
    const totalDeposited =
      typeof account.totalDeposited === "object"
        ? account.totalDeposited.toNumber()
        : Number(account.totalDeposited);

    return {
      exists: true,
      totalDeposited,
      outcomePools: pools,
      outcomeCount,
      status: decodeStatus(account.status),
    };
  } catch {
    return {
      exists: false,
      totalDeposited: 0,
      outcomePools: [],
      outcomeCount: 0,
      status: "unknown",
    };
  }
}
