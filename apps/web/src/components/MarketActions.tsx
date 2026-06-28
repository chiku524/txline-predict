"use client";

import { useCallback, useEffect, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { PredictionMarket } from "@txline-predict/txline-client";
import type { StatValidationPayload } from "@txline-predict/txline-client";
import { formatUsdc, explorerTxUrl } from "@/lib/betting";
import { lamportsToUsdc } from "@/lib/demo-data";
import {
  getDailyScoresMerkleRootsPda,
  getMarketPda,
  getPositionPda,
  getTxLineProgramId,
  getUsdcMint,
} from "@/lib/solana/config";
import { getPredictMarketProgram } from "@/lib/solana/program";
import {
  fetchOnChainMarketStatus,
  toAnchorComparison,
  toAnchorProofNodes,
  toAnchorStatTerm,
  useUserPositions,
} from "@/hooks/useUserPosition";

interface MarketActionsProps {
  market: PredictionMarket;
}

type ActionStep = "idle" | "settle" | "claim" | "done" | "error";

function toAnchorOp(op: StatValidationPayload["op"]) {
  if (op === "Add") return { add: {} };
  if (op === "Subtract") return { subtract: {} };
  return null;
}

export function MarketActions({ market }: MarketActionsProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { positions, refresh: refreshPositions } = useUserPositions(market);

  const [chainStatus, setChainStatus] = useState<
    "open" | "locked" | "resolved" | "cancelled" | "unknown"
  >("unknown");
  const [winningOutcome, setWinningOutcome] = useState<number | null>(null);
  const [step, setStep] = useState<ActionStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const usdcMint = getUsdcMint(network);
  const [marketPda] = getMarketPda(market.fixtureId, market.type);

  const refreshChain = useCallback(async () => {
    const state = await fetchOnChainMarketStatus(connection, marketPda);
    setChainStatus(state.status);
    setWinningOutcome(state.winningOutcome);
  }, [connection, marketPda]);

  useEffect(() => {
    void refreshChain();
  }, [refreshChain]);

  const claimable = positions.find(
    (p) =>
      !p.claimed &&
      chainStatus === "resolved" &&
      winningOutcome != null &&
      p.outcomeIndex === winningOutcome
  );

  const fixtureFinished =
    market.status === "resolved" || market.status === "cancelled";
  const marketExistsOnChain = chainStatus !== "unknown";
  const canSettle =
    fixtureFinished && marketExistsOnChain && chainStatus === "open";

  const settleMarket = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    setStep("settle");
    setError(null);
    setTxSig(null);

    try {
      const res = await fetch(
        `/api/txline/settlement?fixtureId=${encodeURIComponent(market.fixtureId)}&marketType=${market.type}`
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Settlement plan unavailable");
      }
      const data = (await res.json()) as {
        winningOutcomeIndex: number;
        payload: StatValidationPayload;
      };

      const payload = data.payload;
      const [dailyScoresPda] = getDailyScoresMerkleRootsPda(network);
      const txlineProgram = getTxLineProgramId(network);

      const program = getPredictMarketProgram(connection, {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      });

      const sig = await program.methods
        .settleMarket(
          data.winningOutcomeIndex,
          new BN(payload.ts),
          {
            fixtureId: new BN(payload.fixtureSummary.fixtureId),
            updateStats: {
              updateCount: payload.fixtureSummary.updateStats.updateCount,
              minTimestamp: new BN(
                payload.fixtureSummary.updateStats.minTimestamp
              ),
              maxTimestamp: new BN(
                payload.fixtureSummary.updateStats.maxTimestamp
              ),
            },
            eventsSubTreeRoot: payload.fixtureSummary.eventsSubTreeRoot,
          },
          toAnchorProofNodes(payload.fixtureProof),
          toAnchorProofNodes(payload.mainTreeProof),
          {
            threshold: payload.predicate.threshold,
            comparison: toAnchorComparison(payload.predicate.comparison),
          },
          toAnchorStatTerm(payload.statA),
          payload.statB ? toAnchorStatTerm(payload.statB) : null,
          toAnchorOp(payload.op),
          payload.homeScore,
          payload.awayScore
        )
        .accounts({
          keeper: wallet.publicKey,
          market: marketPda,
          dailyScoresMerkleRoots: dailyScoresPda,
          txlineProgram,
        })
        .rpc();

      setTxSig(sig);
      setStep("done");
      await refreshChain();
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    connection,
    market.fixtureId,
    market.type,
    marketPda,
    network,
    refreshChain,
    setVisible,
    wallet,
  ]);

  const claimWinnings = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !claimable) {
      setVisible(true);
      return;
    }

    setStep("claim");
    setError(null);
    setTxSig(null);

    try {
      const [positionPda] = getPositionPda(
        marketPda,
        wallet.publicKey,
        claimable.outcomeIndex
      );
      const depositorAta = getAssociatedTokenAddressSync(
        usdcMint,
        wallet.publicKey
      );
      const vault = getAssociatedTokenAddressSync(usdcMint, marketPda, true);

      const program = getPredictMarketProgram(connection, {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      });

      const sig = await program.methods
        .claim()
        .accounts({
          depositor: wallet.publicKey,
          position: positionPda,
          market: marketPda,
          vault,
          depositorTokenAccount: depositorAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSig(sig);
      setStep("done");
      await Promise.all([refreshChain(), refreshPositions()]);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [
    claimable,
    connection,
    marketPda,
    refreshChain,
    refreshPositions,
    setVisible,
    usdcMint,
    wallet,
  ]);

  const busy = step === "settle" || step === "claim";
  const claimUsdc = claimable
    ? Number(lamportsToUsdc(claimable.amount))
    : 0;

  if (!canSettle && !claimable && chainStatus !== "resolved") return null;

  return (
    <div className="market-actions">
      {canSettle && (
        <button
          type="button"
          className="market-actions__btn market-actions__btn--settle"
          disabled={busy}
          onClick={() => void settleMarket()}
        >
          {busy && step === "settle"
            ? "Settling via TxLINE proof…"
            : "Settle market on-chain"}
        </button>
      )}

      {claimable && (
        <button
          type="button"
          className="market-actions__btn market-actions__btn--claim"
          disabled={busy}
          onClick={() => void claimWinnings()}
        >
          {busy && step === "claim"
            ? "Claiming…"
            : `Claim winnings (~${formatUsdc(claimUsdc)} USDC stake)`}
        </button>
      )}

      {chainStatus === "resolved" && winningOutcome != null && (
        <p className="market-actions__hint">
          On-chain winner:{" "}
          <strong>{market.outcomes[winningOutcome]?.label ?? "—"}</strong>
        </p>
      )}

      {canSettle && (
        <p className="market-actions__hint">
          Permissionless settlement via TxLINE validate_stat CPI. Demo/dev falls
          back to market-authority proof when Merkle path is empty.
        </p>
      )}

      {error && (
        <p className="market-actions__error" role="alert">
          {error}
        </p>
      )}

      {txSig && (
        <a
          href={explorerTxUrl(txSig, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="market-actions__link"
        >
          View transaction →
        </a>
      )}
    </div>
  );
}
