import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/predict_market.json";
import { PREDICT_MARKET_PROGRAM_ID } from "./config";

const positionCoder = new BorshAccountsCoder(idl as Idl);
const marketCoder = new BorshAccountsCoder(idl as Idl);

const POSITION_DISCRIMINATOR = Buffer.from([
  170, 188, 143, 228, 122, 64, 247, 208,
]);

function marketStatusFromChain(
  raw: unknown
): "open" | "locked" | "resolved" | "cancelled" | "unknown" {
  if (!raw || typeof raw !== "object") return "unknown";
  const key = Object.keys(raw)[0];
  if (key === "open") return "open";
  if (key === "locked") return "locked";
  if (key === "resolved") return "resolved";
  if (key === "cancelled") return "cancelled";
  return "unknown";
}

export interface DecodedPosition {
  pubkey: PublicKey;
  market: PublicKey;
  depositor: PublicKey;
  outcomeIndex: number;
  amount: number;
  claimed: boolean;
}

export interface DecodedMarket {
  pubkey: PublicKey;
  fixtureId: string;
  outcomeCount: number;
  status: "open" | "locked" | "resolved" | "cancelled" | "unknown";
  totalDeposited: number;
  outcomePools: number[];
  winningOutcome: number | null;
}

export interface WalletPositionEntry {
  position: DecodedPosition;
  market: DecodedMarket | null;
  estimatedPayout: number | null;
  status: "active" | "claimable" | "won" | "lost";
}

function toNumber(value: number | { toNumber(): number }): number {
  return typeof value === "object" ? value.toNumber() : Number(value);
}

export async function fetchWalletPositions(
  connection: Connection,
  wallet: PublicKey
): Promise<DecodedPosition[]> {
  const accounts = await connection.getProgramAccounts(
    PREDICT_MARKET_PROGRAM_ID,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: POSITION_DISCRIMINATOR.toString("base64"),
            encoding: "base64",
          },
        },
      ],
    }
  );

  return accounts
    .map(({ pubkey, account }) => {
      try {
        const decoded = positionCoder.decode("Position", account.data) as {
          market: PublicKey;
          depositor: PublicKey;
          outcomeIndex: number;
          amount: number | { toNumber(): number };
          claimed: boolean;
        };
        if (!decoded.depositor.equals(wallet)) return null;
        const amount = toNumber(decoded.amount);
        if (amount <= 0) return null;
        return {
          pubkey,
          market: decoded.market,
          depositor: decoded.depositor,
          outcomeIndex: Number(decoded.outcomeIndex),
          amount,
          claimed: Boolean(decoded.claimed),
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is DecodedPosition => p != null);
}

export async function fetchMarketsByPubkeys(
  connection: Connection,
  pubkeys: PublicKey[]
): Promise<Map<string, DecodedMarket>> {
  const unique = [...new Map(pubkeys.map((k) => [k.toBase58(), k])).values()];
  if (unique.length === 0) return new Map();

  const infos = await connection.getMultipleAccountsInfo(unique);
  const map = new Map<string, DecodedMarket>();

  unique.forEach((pubkey, i) => {
    const info = infos[i];
    if (!info) return;
    try {
      const decoded = marketCoder.decode("Market", info.data) as {
        fixtureId: string;
        outcomeCount: number;
        status: unknown;
        totalDeposited: number | { toNumber(): number };
        outcomePools: number[];
        winningOutcome: number | null | { toNumber(): number };
      };
      const winningOutcome =
        decoded.winningOutcome == null
          ? null
          : toNumber(decoded.winningOutcome as number | { toNumber(): number });
      map.set(pubkey.toBase58(), {
        pubkey,
        fixtureId: decoded.fixtureId,
        outcomeCount: Number(decoded.outcomeCount),
        status: marketStatusFromChain(decoded.status),
        totalDeposited: toNumber(decoded.totalDeposited),
        outcomePools: decoded.outcomePools.map(Number),
        winningOutcome,
      });
    } catch {
      /* skip malformed */
    }
  });

  return map;
}

export function classifyPosition(
  position: DecodedPosition,
  market: DecodedMarket | null
): Pick<WalletPositionEntry, "status" | "estimatedPayout"> {
  if (position.claimed) {
    return { status: "won", estimatedPayout: null };
  }

  if (!market || market.status === "unknown") {
    return { status: "active", estimatedPayout: null };
  }

  if (market.status === "resolved" && market.winningOutcome != null) {
    if (position.outcomeIndex === market.winningOutcome) {
      const pool = market.outcomePools[market.winningOutcome] ?? 0;
      const payout =
        pool > 0
          ? Math.floor(
              (position.amount * market.totalDeposited) / pool
            )
          : position.amount;
      return { status: "claimable", estimatedPayout: payout };
    }
    return { status: "lost", estimatedPayout: null };
  }

  return { status: "active", estimatedPayout: null };
}

export async function fetchWalletPortfolio(
  connection: Connection,
  wallet: PublicKey
): Promise<WalletPositionEntry[]> {
  const positions = await fetchWalletPositions(connection, wallet);
  if (positions.length === 0) return [];

  const marketMap = await fetchMarketsByPubkeys(
    connection,
    positions.map((p) => p.market)
  );

  return positions.map((position) => {
    const market = marketMap.get(position.market.toBase58()) ?? null;
    const { status, estimatedPayout } = classifyPosition(position, market);
    return { position, market, status, estimatedPayout };
  });
}

export function parseChainFixtureId(chainId: string): {
  fixtureId: string;
  marketType: string;
} | null {
  const idx = chainId.lastIndexOf(":");
  if (idx <= 0) return null;
  return {
    fixtureId: chainId.slice(0, idx),
    marketType: chainId.slice(idx + 1),
  };
}
