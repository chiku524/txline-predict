"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { Modal } from "@/components/Modal";
import { useBetCelebration } from "@/components/BetCelebrationProvider";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import {
  QUICK_STAKES,
  estimateParimutuelProfit,
  estimateParimutuelReturn,
  explorerTxUrl,
  formatKickoff,
  formatOdds,
  formatUsdc,
} from "@/lib/betting";
import { lamportsToUsdc } from "@/lib/demo-data";
import {
  parseUsdcAmount,
  USDC_DECIMALS,
} from "@/lib/solana/config";
import { fetchOnChainMarket } from "@/lib/solana/market";
import {
  assertBetPreflight,
  buildBetTransaction,
  sendBetTransaction,
} from "@/lib/solana/bet-transaction";
import { getPredictMarketProgram } from "@/lib/solana/program";
import { outcomeToneClass } from "@/lib/outcome-colors";

type BetStep = "idle" | "preflight" | "signing" | "done" | "error";
interface BetModalProps {
  open: boolean;
  market: PredictionMarket;
  outcomeIndex: number;
  onClose: () => void;
}

function marketTypeLabel(type: PredictionMarket["type"]): string {
  if (type === "match_winner") return "Match winner";
  if (type === "total_goals") return "Total goals";
  if (type === "both_teams_score") return "Both teams score";
  return type;
}

export function BetModal({
  open,
  market,
  outcomeIndex,
  onClose,
}: BetModalProps) {
  const outcome = market.outcomes[outcomeIndex];
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { balance, refresh } = useUsdcBalance();
  const { celebrateBet } = useBetCelebration();

  const [amount, setAmount] = useState("5");
  const [step, setStep] = useState<BetStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [chainPools, setChainPools] = useState<{
    total: number;
    outcome: number;
  } | null>(null);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const isDevnet = network !== "mainnet-beta";

  const stake = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const stakeLamports = useMemo(() => parseUsdcAmount(amount), [amount]);

  const displayTotalPool =
    chainPools?.total ?? market.totalPoolLamports;
  const displayOutcomePool =
    chainPools?.outcome ??
    (outcome?.poolLamports ?? 0);

  const implied = outcome?.impliedProbability;
  const potentialReturn = estimateParimutuelReturn(
    stakeLamports,
    displayOutcomePool,
    displayTotalPool
  );
  const potentialProfit = estimateParimutuelProfit(
    stakeLamports,
    displayOutcomePool,
    displayTotalPool
  );
  const oddsLabel = formatOdds(implied);
  const poolPct =
    displayTotalPool > 0
      ? Math.round((displayOutcomePool / displayTotalPool) * 100)
      : 0;
  const usingChainPools = chainPools != null && chainPools.total > 0;

  const insufficientBalance =
    balance != null && stake > 0 && stake > balance;

  const busy = step === "preflight" || step === "signing";
  const success = step === "done" && txSig != null;

  useEffect(() => {
    if (open) {
      setAmount("5");
      setStep("idle");
      setError(null);
      setTxSig(null);
      setChainPools(null);
    }
  }, [open, outcomeIndex]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void fetchOnChainMarket(connection, market.fixtureId, market.type)
      .then((state) => {
        if (cancelled || !state.exists) return;
        setChainPools({
          total: state.totalDeposited,
          outcome: state.outcomePools[outcomeIndex] ?? 0,
        });
      })
      .catch(() => {
        /* RPC unavailable — keep off-chain pool estimates */
      });

    return () => {
      cancelled = true;
    };
  }, [
    connection,
    market.fixtureId,
    market.type,
    open,
    outcomeIndex,
  ]);

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  const placeBet = useCallback(async () => {
    if (!outcome) return;
    setError(null);
    setTxSig(null);

    if (!wallet.publicKey || !wallet.signTransaction) {
      setVisible(true);
      return;
    }

    const lamports = parseUsdcAmount(amount);
    if (lamports <= 0) {
      setError("Enter a valid stake amount.");
      return;
    }

    if (balance != null && lamports / 10 ** USDC_DECIMALS > balance) {
      setError("Insufficient USDC. Fund your wallet on devnet first.");
      return;
    }

    setStep("preflight");

    try {
      await assertBetPreflight(
        connection,
        market.fixtureId,
        market.type,
        market.kickoffUtc,
        lamports,
        wallet.publicKey,
        network
      );

      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };

      const program = getPredictMarketProgram(connection, anchorWallet);
      const tx = await buildBetTransaction({
        program,
        connection,
        wallet: wallet.publicKey,
        fixtureId: market.fixtureId,
        marketType: market.type,
        kickoffUtc: market.kickoffUtc,
        outcomeCount: market.outcomes.length,
        outcomeIndex,
        stakeLamports: lamports,
        network,
      });

      setStep("signing");
      const sig = await sendBetTransaction(connection, tx, anchorWallet);

      setTxSig(sig);
      setStep("done");
      celebrateBet();
      void refresh();
    } catch (err) {
      setStep("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("AccountNotFound") ||
        msg.includes("does not exist") ||
        msg.includes("Invalid program")
      ) {
        setError(
          "Prediction program not found. Switch your wallet to devnet."
        );
      } else if (msg.includes("User rejected")) {
        setError("Transaction cancelled in wallet.");
      } else {
        setError(msg.length > 240 ? `${msg.slice(0, 240)}…` : msg);
      }
    }
  }, [
    amount,
    balance,
    connection,
    market.fixtureId,
    market.kickoffUtc,
    market.outcomes.length,
    market.type,
    network,
    outcome,
    outcomeIndex,
    refresh,
    celebrateBet,
    setVisible,
    wallet,
  ]);

  const stepLabel =
    step === "preflight"
      ? "Checking wallet and market…"
      : step === "signing"
        ? "Approve the transaction in your wallet…"
        : null;

  if (!outcome) return null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      dismissible={!busy}
      title={success ? "Bet confirmed" : "Place your bet"}
      description={
        success
          ? undefined
          : `${market.homeTeam} vs ${market.awayTeam} · ${marketTypeLabel(market.type)}`
      }
    >
      {success ? (
        <div className="bet-modal-success">
          <div className="bet-modal-success__icon" aria-hidden>
            ✓
          </div>
          <p className="bet-modal-success__headline">
            {formatUsdc(stake)} USDC on{" "}
            <strong>{outcome.label}</strong>
          </p>
          <p className="bet-modal-success__sub">
            Your stake is locked in the on-chain escrow pool until settlement.
          </p>
          <a
            href={explorerTxUrl(txSig!, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="bet-panel__link"
          >
            View on Solana Explorer →
          </a>
          <button
            type="button"
            className="bet-panel__primary bet-modal-success__done"
            onClick={handleClose}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="bet-modal-match">
            <div className="bet-modal-match__teams">
              <span>{market.homeTeam}</span>
              <span className="bet-modal-match__vs">vs</span>
              <span>{market.awayTeam}</span>
            </div>
            <p className="bet-modal-match__kickoff">
              {formatKickoff(market.kickoffUtc)}
            </p>
          </div>

          <div
            className={`bet-modal-pick ${outcomeToneClass(outcome.id, "bet-modal-pick")}`}
          >
            <div>
              <p className="bet-panel__eyebrow">Your selection</p>
              <p className="bet-modal-pick__label">{outcome.label}</p>
            </div>
            <div className="bet-modal-pick__odds">
              <span className="bet-modal-pick__odds-value">{oddsLabel}x</span>
              {implied != null && (
                <span className="bet-modal-pick__prob">
                  {(implied * 100).toFixed(1)}% implied
                </span>
              )}
            </div>
          </div>

          <div className="bet-modal-stats">
            <div className="bet-modal-stat">
              <span className="bet-modal-stat__label">
                {usingChainPools ? "On-chain pool" : "Market pool"}
              </span>
              <span className="bet-modal-stat__value">
                {formatUsdc(Number(lamportsToUsdc(displayTotalPool)))}{" "}
                USDC
              </span>
            </div>
            <div className="bet-modal-stat">
              <span className="bet-modal-stat__label">This side</span>
              <span className="bet-modal-stat__value">{poolPct}% of pool</span>
            </div>
          </div>

          <label className="bet-panel__label" htmlFor="bet-modal-stake">
            Stake amount
          </label>
          <div className="bet-panel__amount-row">
            <input
              id="bet-modal-stake"
              type="number"
              min="0.1"
              step="0.1"
              inputMode="decimal"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              className="bet-panel__input"
              placeholder="0.00"
              autoFocus
            />
            <span className="bet-panel__suffix">USDC</span>
          </div>

          <div className="bet-panel__chips">
            {QUICK_STAKES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => setAmount(String(q))}
                className={`bet-chip ${amount === String(q) ? "bet-chip--active" : ""}`}
              >
                ${q}
              </button>
            ))}
            {balance != null && balance > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setAmount(String(Math.floor(balance * 100) / 100))
                }
                className="bet-chip"
              >
                Max
              </button>
            )}
          </div>

          <div className="bet-panel__summary">
            <div className="bet-panel__summary-row">
              <span>Potential return</span>
              <span className="bet-panel__summary-value">
                {potentialReturn != null
                  ? `~${formatUsdc(potentialReturn)} USDC`
                  : "—"}
              </span>
            </div>
            {potentialProfit != null && stake > 0 && (
              <div className="bet-panel__summary-row">
                <span>Potential profit</span>
                <span className="bet-panel__summary-value">
                  ~{formatUsdc(potentialProfit)} USDC
                </span>
              </div>
            )}
            <div className="bet-panel__summary-row bet-panel__summary-row--muted">
              <span>Payout model</span>
              <span>Parimutuel pool share</span>
            </div>
            {wallet.publicKey && balance != null ? (
              <div className="bet-panel__summary-row bet-panel__summary-row--muted">
                <span>Wallet balance</span>
                <span>{formatUsdc(balance)} USDC</span>
              </div>
            ) : (
              <div className="bet-panel__summary-row bet-panel__summary-row--muted">
                <span>Wallet</span>
                <span>Not connected</span>
              </div>
            )}
          </div>

          {(stepLabel || error) && (
            <p
              className={`bet-panel__status ${error ? "bet-panel__status--error" : ""}`}
              role="status"
            >
              {error ?? stepLabel}
            </p>
          )}

          {isDevnet && (
            <p className="bet-modal-footnote">
              Devnet test USDC only. You also need ~0.02 SOL on devnet for fees
              and account rent. Stakes are held in on-chain escrow until
              settlement via TxLINE.
            </p>
          )}

          <div className="bet-panel__actions bet-modal-actions">
            <button
              type="button"
              className="bet-panel__ghost"
              disabled={busy}
              onClick={handleClose}
            >
              Cancel
            </button>
            {!wallet.publicKey ? (
              <button
                type="button"
                className="bet-panel__primary"
                onClick={() => setVisible(true)}
              >
                Connect wallet
              </button>
            ) : (
              <button
                type="button"
                className="bet-panel__primary"
                disabled={busy || insufficientBalance || stake <= 0}
                onClick={() => void placeBet()}
              >
                {busy
                  ? "Processing…"
                  : `Confirm · ${formatUsdc(stake)} USDC`}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
