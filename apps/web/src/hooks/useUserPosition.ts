"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PredictionMarket } from "@txline-predict/txline-client";
import type { StatValidationPayload } from "@txline-predict/txline-client";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "@/lib/solana/idl/predict_market.json";
import { decodeMarketStatus } from "@/lib/solana/chain-status";
import {
  getMarketPda,
  getPositionPda,
} from "@/lib/solana/config";

const positionCoder = new BorshAccountsCoder(idl as Idl);

export interface UserPositionState {
  outcomeIndex: number;
  amount: number;
  claimed: boolean;
  exists: boolean;
}

export function useUserPositions(
  market: PredictionMarket,
  enabled = true
): {
  positions: UserPositionState[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [positions, setPositions] = useState<UserPositionState[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !wallet.publicKey) {
      setPositions([]);
      return;
    }

    setLoading(true);
    try {
      const [marketPda] = getMarketPda(market.fixtureId, market.type);
      const reads = await Promise.all(
        market.outcomes.map(async (_, outcomeIndex) => {
          const [positionPda] = getPositionPda(
            marketPda,
            wallet.publicKey!,
            outcomeIndex
          );
          let info;
          try {
            info = await connection.getAccountInfo(positionPda);
          } catch {
            return {
              outcomeIndex,
              amount: 0,
              claimed: false,
              exists: false,
            };
          }
          if (!info) {
            return {
              outcomeIndex,
              amount: 0,
              claimed: false,
              exists: false,
            };
          }
          try {
            const decoded = positionCoder.decode("Position", info.data) as {
              amount: number | { toNumber(): number };
              claimed: boolean;
            };
            const amount =
              typeof decoded.amount === "object"
                ? decoded.amount.toNumber()
                : Number(decoded.amount);
            return {
              outcomeIndex,
              amount,
              claimed: Boolean(decoded.claimed),
              exists: amount > 0,
            };
          } catch {
            return {
              outcomeIndex,
              amount: 0,
              claimed: false,
              exists: false,
            };
          }
        })
      );
      setPositions(reads.filter((p) => p.exists));
    } finally {
      setLoading(false);
    }
  }, [
    connection,
    enabled,
    market.fixtureId,
    market.outcomes,
    market.type,
    wallet.publicKey,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { positions, loading, refresh };
}

export function toAnchorComparison(
  comparison: StatValidationPayload["predicate"]["comparison"]
): Record<string, Record<string, never>> {
  if (comparison === "LessThan") return { lessThan: {} };
  if (comparison === "EqualTo") return { equalTo: {} };
  return { greaterThan: {} };
}

export function toAnchorProofNodes(
  nodes: StatValidationPayload["fixtureProof"]
): { hash: number[]; isRightSibling: boolean }[] {
  return nodes.map((n) => ({
    hash: n.hash,
    isRightSibling: n.isRightSibling,
  }));
}

export function toAnchorStatTerm(term: StatValidationPayload["statA"]) {
  return {
    statToProve: {
      key: term.statToProve.key,
      value: term.statToProve.value,
      period: term.statToProve.period,
    },
    eventStatRoot: term.eventStatRoot,
    statProof: toAnchorProofNodes(term.statProof),
  };
}

export function marketStatusFromChain(
  status: unknown
): "open" | "locked" | "resolved" | "cancelled" | "unknown" {
  return decodeMarketStatus(status);
}

export async function fetchOnChainMarketStatus(
  connection: ReturnType<typeof useConnection>["connection"],
  marketPda: PublicKey
): Promise<{
  status: ReturnType<typeof marketStatusFromChain>;
  winningOutcome: number | null;
  settlementRoot: string | null;
}> {
  const marketCoder = new BorshAccountsCoder(idl as Idl);
  let info;
  try {
    info = await connection.getAccountInfo(marketPda);
  } catch {
    return { status: "unknown", winningOutcome: null, settlementRoot: null };
  }
  if (!info) {
    return { status: "unknown", winningOutcome: null, settlementRoot: null };
  }
  const account = marketCoder.decode("Market", info.data) as {
    status: unknown;
    winningOutcome: number | null | { toNumber(): number };
    settlementRoot: number[] | null;
  };
  const winningOutcome =
    account.winningOutcome == null
      ? null
      : typeof account.winningOutcome === "object"
        ? account.winningOutcome.toNumber()
        : Number(account.winningOutcome);
  const root = account.settlementRoot;
  const settlementRoot =
    root && Array.isArray(root)
      ? root.map((b) => Number(b).toString(16).padStart(2, "0")).join("")
      : null;

  return {
    status: marketStatusFromChain(account.status),
    winningOutcome,
    settlementRoot,
  };
}
