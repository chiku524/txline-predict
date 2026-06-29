"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { PredictionMarket } from "@txline-predict/txline-client";
import {
  fetchWalletPortfolio,
  parseChainFixtureId,
  type WalletPositionEntry,
} from "@/lib/solana/positions";
import { defaultOutcomeLabel } from "@/lib/solana/anchor-decode";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";

export interface EnrichedBet extends WalletPositionEntry {
  marketMeta: PredictionMarket | null;
  outcomeLabel: string;
}

export interface WalletDashboardStats {
  activeCount: number;
  activeStake: number;
  claimableCount: number;
  claimableValue: number;
  lostCount: number;
  wonCount: number;
}

export function useWalletDashboard(markets: PredictionMarket[]) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { balance, loading: balanceLoading, refresh: refreshBalance } =
    useUsdcBalance();

  const [bets, setBets] = useState<EnrichedBet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketIndex = useMemo(() => {
    const map = new Map<string, PredictionMarket>();
    for (const m of markets) {
      map.set(`${m.fixtureId}:${m.type}`, m);
    }
    return map;
  }, [markets]);

  const refresh = useCallback(async () => {
    if (!wallet.publicKey) {
      setBets([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const portfolio = await fetchWalletPortfolio(connection, wallet.publicKey);
      const enriched: EnrichedBet[] = portfolio.map((entry) => {
        const parsed = entry.market
          ? parseChainFixtureId(entry.market.fixtureId)
          : null;
        const key = parsed ? `${parsed.fixtureId}:${parsed.marketType}` : null;
        const marketMeta = key ? (marketIndex.get(key) ?? null) : null;
        const idx = entry.position.outcomeIndex;
        const outcomeLabel =
          marketMeta?.outcomes[idx]?.label ??
          (parsed
            ? defaultOutcomeLabel(parsed.marketType, idx)
            : `Outcome ${idx + 1}`);

        return { ...entry, marketMeta, outcomeLabel };
      });

      enriched.sort((a, b) => {
        const rank = (s: EnrichedBet["status"]) =>
          s === "claimable" ? 0 : s === "active" ? 1 : s === "lost" ? 2 : 3;
        return rank(a.status) - rank(b.status);
      });

      setBets(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio");
      setBets([]);
    } finally {
      setLoading(false);
    }
  }, [connection, marketIndex, wallet.publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo((): WalletDashboardStats => {
    let activeCount = 0;
    let activeStake = 0;
    let claimableCount = 0;
    let claimableValue = 0;
    let lostCount = 0;
    let wonCount = 0;

    for (const bet of bets) {
      if (bet.status === "active") {
        activeCount += 1;
        activeStake += bet.position.amount;
      } else if (bet.status === "claimable") {
        claimableCount += 1;
        claimableValue += bet.estimatedPayout ?? bet.position.amount;
      } else if (bet.status === "lost") {
        lostCount += 1;
      } else if (bet.status === "won" || bet.position.claimed) {
        wonCount += 1;
      }
    }

    return {
      activeCount,
      activeStake,
      claimableCount,
      claimableValue,
      lostCount,
      wonCount,
    };
  }, [bets]);

  return {
    connected: Boolean(wallet.publicKey),
    publicKey: wallet.publicKey,
    balance,
    balanceLoading,
    bets,
    stats,
    loading,
    error,
    refresh: async () => {
      await Promise.all([refresh(), refreshBalance()]);
    },
  };
}
