import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/predict_market.json";
import { PREDICT_MARKET_PROGRAM_ID } from "./config";
import { decodeMarketStatus } from "./chain-status";
import { anchorField, anchorNumber } from "./anchor-decode";

const positionCoder = new BorshAccountsCoder(idl as Idl);
const marketCoder = new BorshAccountsCoder(idl as Idl);

const POSITION_DISCRIMINATOR = Buffer.from([
  170, 188, 143, 228, 122, 64, 247, 208,
]);

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
        const decoded = positionCoder.decode("Position", account.data) as Record<
          string,
          unknown
        >;
        const depositor = anchorField<{ equals(b: unknown): boolean }>(
          decoded,
          "depositor"
        );
        if (!depositor?.equals(wallet)) return null;
        const amount = anchorNumber(anchorField(decoded, "amount"));
        if (amount <= 0) return null;
        const market = anchorField<{ toBase58(): string }>(decoded, "market");
        if (!market) return null;
        return {
          pubkey,
          market: market as import("@solana/web3.js").PublicKey,
          depositor: depositor as import("@solana/web3.js").PublicKey,
          outcomeIndex: anchorNumber(
            anchorField(decoded, "outcomeIndex", "outcome_index")
          ),
          amount,
          claimed: Boolean(anchorField(decoded, "claimed")),
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
      const decoded = marketCoder.decode("Market", info.data) as Record<
        string,
        unknown
      >;
      const fixtureId = anchorField<string>(decoded, "fixtureId", "fixture_id");
      if (!fixtureId) return;
      const outcomeCount = anchorNumber(
        anchorField(decoded, "outcomeCount", "outcome_count")
      );
      const rawPools =
        anchorField<number[]>(decoded, "outcomePools", "outcome_pools") ?? [];
      const winningRaw = anchorField(decoded, "winningOutcome", "winning_outcome");
      const winningOutcome =
        winningRaw == null ? null : anchorNumber(winningRaw);
      map.set(pubkey.toBase58(), {
        pubkey,
        fixtureId,
        outcomeCount,
        status: decodeMarketStatus(anchorField(decoded, "status")),
        totalDeposited: anchorNumber(
          anchorField(decoded, "totalDeposited", "total_deposited")
        ),
        outcomePools: rawPools.slice(0, outcomeCount).map(Number),
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
