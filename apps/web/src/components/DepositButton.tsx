"use client";

import { useCallback, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { SystemProgram, Transaction } from "@solana/web3.js";
import type { PredictionMarket } from "@txline-predict/txline-client";
import {
  getMarketPda,
  getUsdcMint,
  parseUsdcAmount,
} from "@/lib/solana/config";
import { getPredictMarketProgram } from "@/lib/solana/program";

interface DepositButtonProps {
  market: PredictionMarket;
  outcomeIndex: number;
  label: string;
}

export function DepositButton({
  market,
  outcomeIndex,
  label,
}: DepositButtonProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("1");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const usdcMint = getUsdcMint(network);

  const onDeposit = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setStatus("Connect your wallet first.");
      return;
    }

    const lamports = parseUsdcAmount(amount);
    if (lamports <= 0) {
      setStatus("Enter a valid USDC amount.");
      return;
    }

    setLoading(true);
    setStatus(null);

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
        setStatus("Creating on-chain market vault…");
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

      const ataInfo = await connection.getAccountInfo(depositorAta);
      if (!ataInfo) {
        setStatus("Creating USDC token account…");
        const ix = createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          depositorAta,
          wallet.publicKey,
          usdcMint
        );
        const tx = new Transaction().add(ix);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const signed = await wallet.signTransaction(tx);
        await connection.sendRawTransaction(signed.serialize());
      }

      setStatus(`Depositing ${amount} USDC on "${label}"…`);
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

      setStatus(`Deposited! Tx: ${sig.slice(0, 12)}…`);
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("AccountNotFound") ||
        msg.includes("does not exist") ||
        msg.includes("Invalid program")
      ) {
        setStatus(
          "Program not deployed on this cluster. Deploy predict_market to devnet first."
        );
      } else {
        setStatus(msg.slice(0, 220));
      }
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    connection,
    label,
    market.fixtureId,
    market.kickoffUtc,
    market.outcomes.length,
    outcomeIndex,
    usdcMint,
    wallet,
  ]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-lg border border-[var(--accent)]/40 py-1.5 text-xs font-medium text-[var(--accent)] hover:bg-[rgba(34,211,166,0.08)]"
      >
        Back {label}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 text-xs font-medium">{label}</div>
      <div className="flex gap-2">
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={loading}
          onClick={onDeposit}
          className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[#04120e] disabled:opacity-50"
        >
          {loading ? "…" : "Deposit"}
        </button>
      </div>
      {status && <p className="mt-2 text-[10px] text-[var(--muted)]">{status}</p>}
    </div>
  );
}
