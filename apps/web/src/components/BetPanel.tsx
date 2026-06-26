"use client";

import { useCallback, useMemo, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SystemProgram, Transaction } from "@solana/web3.js";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import {
  QUICK_STAKES,
  estimateReturn,
  explorerTxUrl,
  formatOdds,
  formatUsdc,
} from "@/lib/betting";
import {
  getMarketPda,
  getUsdcMint,
  parseUsdcAmount,
  USDC_DECIMALS,
} from "@/lib/solana/config";
import { getPredictMarketProgram } from "@/lib/solana/program";

type BetStep = "idle" | "market" | "wallet" | "deposit" | "done" | "error";

interface BetPanelProps {
  market: PredictionMarket;
  outcomeIndex: number;
  label: string;
  impliedProbability?: number;
  onSuccess?: () => void;
  onCancel: () => void;
}

export function BetPanel({
  market,
  outcomeIndex,
  label,
  impliedProbability,
  onSuccess,
  onCancel,
}: BetPanelProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { balance, refresh } = useUsdcBalance();

  const [amount, setAmount] = useState("5");
  const [step, setStep] = useState<BetStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const usdcMint = getUsdcMint(network);

  const stake = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amount]);

  const potentialReturn = estimateReturn(stake, impliedProbability);
  const oddsLabel = formatOdds(impliedProbability);

  const insufficientBalance =
    balance != null && stake > 0 && stake > balance;

  const placeBet = useCallback(async () => {
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
      setError("Insufficient USDC balance. Get devnet USDC from the Circle faucet.");
      return;
    }

    setStep("market");

    try {
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };

      const program = getPredictMarketProgram(connection, anchorWallet);
      const [marketPda] = getMarketPda(market.fixtureId);
      const vault = getAssociatedTokenAddressSync(usdcMint, marketPda, true);
      const depositorAta = getAssociatedTokenAddressSync(
        usdcMint,
        wallet.publicKey
      );

      const marketAccount = await connection.getAccountInfo(marketPda);
      const lockTs = Math.floor(new Date(market.kickoffUtc).getTime() / 1000);

      if (!marketAccount) {
        await program.methods
          .createMarket(market.fixtureId, market.outcomes.length, new BN(lockTs))
          .accounts({
            authority: wallet.publicKey,
            market: marketPda,
            usdcMint,
            vault,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      }

      setStep("wallet");
      const ataInfo = await connection.getAccountInfo(depositorAta);
      if (!ataInfo) {
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          depositorAta,
          wallet.publicKey,
          usdcMint
        );
        const tx = new Transaction().add(ix);
        tx.feePayer = wallet.publicKey;
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        const signed = await wallet.signTransaction(tx);
        const ataSig = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(
          { signature: ataSig, blockhash, lastValidBlockHeight },
          "confirmed"
        );
      }

      setStep("deposit");
      const sig = await program.methods
        .deposit(outcomeIndex, new BN(lamports))
        .accounts({
          depositor: wallet.publicKey,
          market: marketPda,
          depositorTokenAccount: depositorAta,
          vault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      setTxSig(sig);
      setStep("done");
      void refresh();
      onSuccess?.();
    } catch (err) {
      setStep("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("AccountNotFound") ||
        msg.includes("does not exist") ||
        msg.includes("Invalid program")
      ) {
        setError(
          "Prediction program not found on this network. Switch wallet to devnet."
        );
      } else if (msg.includes("User rejected")) {
        setError("Transaction cancelled.");
      } else {
        setError(msg.length > 180 ? `${msg.slice(0, 180)}…` : msg);
      }
    }
  }, [
    amount,
    balance,
    connection,
    market.fixtureId,
    market.kickoffUtc,
    market.outcomes.length,
    onSuccess,
    outcomeIndex,
    refresh,
    setVisible,
    usdcMint,
    wallet,
  ]);

  const busy = step === "market" || step === "wallet" || step === "deposit";

  const stepLabel =
    step === "market"
      ? "Preparing market vault…"
      : step === "wallet"
        ? "Setting up USDC account…"
        : step === "deposit"
          ? "Confirm in your wallet…"
          : null;

  if (step === "done" && txSig) {
    return (
      <div className="bet-panel bet-panel--success">
        <div className="bet-panel__success-icon" aria-hidden>
          ✓
        </div>
        <div>
          <p className="bet-panel__title">Bet placed</p>
          <p className="bet-panel__meta">
            {formatUsdc(stake)} USDC on <strong>{label}</strong>
          </p>
          <a
            href={explorerTxUrl(txSig, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="bet-panel__link"
          >
            View transaction →
          </a>
        </div>
        <button type="button" className="bet-panel__ghost" onClick={onCancel}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="bet-panel">
      <div className="bet-panel__header">
        <div>
          <p className="bet-panel__eyebrow">Your pick</p>
          <p className="bet-panel__title">{label}</p>
        </div>
        <div className="bet-panel__odds-pill">{oddsLabel}x</div>
      </div>

      <label className="bet-panel__label" htmlFor={`stake-${market.id}`}>
        Stake (USDC)
      </label>
      <div className="bet-panel__amount-row">
        <input
          id={`stake-${market.id}`}
          type="number"
          min="0.1"
          step="0.1"
          inputMode="decimal"
          value={amount}
          disabled={busy}
          onChange={(e) => setAmount(e.target.value)}
          className="bet-panel__input"
          placeholder="0.00"
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
            onClick={() => setAmount(String(Math.floor(balance * 100) / 100))}
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
        <div className="bet-panel__summary-row bet-panel__summary-row--muted">
          <span>TxLINE fair odds</span>
          <span>{oddsLabel}x</span>
        </div>
        {wallet.publicKey && balance != null && (
          <div className="bet-panel__summary-row bet-panel__summary-row--muted">
            <span>Wallet balance</span>
            <span>{formatUsdc(balance)} USDC</span>
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

      <div className="bet-panel__actions">
        <button
          type="button"
          className="bet-panel__ghost"
          disabled={busy}
          onClick={onCancel}
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
            {busy ? "Processing…" : `Place bet · ${formatUsdc(stake)} USDC`}
          </button>
        )}
      </div>
    </div>
  );
}
