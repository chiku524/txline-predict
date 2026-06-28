"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { formatKickoff, formatUsdc, explorerTxUrl } from "@/lib/betting";
import { lamportsToUsdc } from "@/lib/demo-data";
import type { EnrichedBet } from "@/hooks/useWalletDashboard";
import { useWalletDashboard } from "@/hooks/useWalletDashboard";
import { getMarketPda, getPositionPda, getUsdcMint } from "@/lib/solana/config";
import { getPredictMarketProgram } from "@/lib/solana/program";

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function marketTypeLabel(type: PredictionMarket["type"]): string {
  if (type === "match_winner") return "Match winner";
  if (type === "total_goals") return "Total goals";
  if (type === "both_teams_score") return "Both teams score";
  return type;
}

function statusLabel(status: EnrichedBet["status"], claimed: boolean): string {
  if (claimed) return "Claimed";
  if (status === "claimable") return "Ready to claim";
  if (status === "active") return "In escrow";
  if (status === "lost") return "Settled — lost";
  return "Settled";
}

function statusClass(status: EnrichedBet["status"], claimed: boolean): string {
  if (claimed) return "dashboard-badge--won";
  if (status === "claimable") return "dashboard-badge--claim";
  if (status === "active") return "dashboard-badge--active";
  if (status === "lost") return "dashboard-badge--lost";
  return "dashboard-badge--muted";
}

function DashboardBetRow({
  bet,
  onClaimed,
}: {
  bet: EnrichedBet;
  onClaimed: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const usdcMint = getUsdcMint(network);
  const meta = bet.marketMeta;

  const claim = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !bet.market) return;
    setClaiming(true);
    setError(null);
    try {
      const parsed = bet.market.fixtureId.split(":");
      const marketType = parsed[1] as PredictionMarket["type"];
      const fixtureId = parsed[0];
      const [marketPda] = getMarketPda(fixtureId, marketType);
      const [positionPda] = getPositionPda(
        marketPda,
        wallet.publicKey,
        bet.position.outcomeIndex
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
      onClaimed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Claim failed");
    } finally {
      setClaiming(false);
    }
  }, [bet, connection, onClaimed, usdcMint, wallet]);

  const stakeUsdc = Number(lamportsToUsdc(bet.position.amount));
  const payoutUsdc =
    bet.estimatedPayout != null
      ? Number(lamportsToUsdc(bet.estimatedPayout))
      : null;

  return (
    <article className="dashboard-bet">
      <div className="dashboard-bet__main">
        <div>
          {meta ? (
            <>
              <p className="dashboard-bet__type">
                {marketTypeLabel(meta.type)}
                {meta.competitionName && (
                  <span> · {meta.competitionName}</span>
                )}
              </p>
              <h3 className="dashboard-bet__title">
                {meta.homeTeam} vs {meta.awayTeam}
              </h3>
              <p className="dashboard-bet__kickoff">
                {formatKickoff(meta.kickoffUtc)}
              </p>
            </>
          ) : (
            <>
              <p className="dashboard-bet__type">On-chain position</p>
              <h3 className="dashboard-bet__title">
                {bet.market?.fixtureId ?? bet.position.market.toBase58().slice(0, 12)}
              </h3>
            </>
          )}
        </div>
        <span
          className={`dashboard-badge ${statusClass(bet.status, bet.position.claimed)}`}
        >
          {statusLabel(bet.status, bet.position.claimed)}
        </span>
      </div>

      <div className="dashboard-bet__details">
        <div>
          <span className="dashboard-bet__label">Selection</span>
          <span className="dashboard-bet__value">{bet.outcomeLabel}</span>
        </div>
        <div>
          <span className="dashboard-bet__label">Stake</span>
          <span className="dashboard-bet__value">
            {formatUsdc(stakeUsdc)} USDC
          </span>
        </div>
        {payoutUsdc != null && bet.status === "claimable" && (
          <div>
            <span className="dashboard-bet__label">Est. payout</span>
            <span className="dashboard-bet__value dashboard-bet__value--accent">
              ~{formatUsdc(payoutUsdc)} USDC
            </span>
          </div>
        )}
      </div>

      <div className="dashboard-bet__actions">
        {meta && (
          <Link href="/markets" className="dashboard-bet__link">
            View markets
          </Link>
        )}
        {bet.status === "claimable" && !bet.position.claimed && (
          <button
            type="button"
            className="dashboard-bet__claim"
            disabled={claiming}
            onClick={() => {
              if (!wallet.publicKey) {
                setVisible(true);
                return;
              }
              void claim();
            }}
          >
            {claiming ? "Claiming…" : "Claim winnings"}
          </button>
        )}
      </div>

      {error && <p className="dashboard-bet__error">{error}</p>}
      {txSig && (
        <a
          href={explorerTxUrl(txSig, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="dashboard-bet__link"
        >
          View claim tx →
        </a>
      )}
    </article>
  );
}

export function WalletDashboard({
  markets,
}: {
  markets: PredictionMarket[];
}) {
  const { setVisible } = useWalletModal();
  const {
    connected,
    publicKey,
    balance,
    balanceLoading,
    bets,
    stats,
    loading,
    error,
    refresh,
  } = useWalletDashboard(markets);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

  if (!connected || !publicKey) {
    return (
      <section className="dashboard-empty card p-8 text-center">
        <h1 className="dashboard-empty__title">Your wallet dashboard</h1>
        <p className="dashboard-empty__body">
          Connect a Solana wallet to view your active bets, escrow stakes, and
          claimable winnings across all TxLINE Predict markets.
        </p>
        <button
          type="button"
          className="dashboard-empty__cta"
          onClick={() => setVisible(true)}
        >
          Connect wallet
        </button>
      </section>
    );
  }

  const address = publicKey.toBase58();

  return (
    <div className="dashboard space-y-8">
      <header className="dashboard-header card p-6">
        <div className="dashboard-header__top">
          <div>
            <p className="dashboard-header__eyebrow">Wallet profile</p>
            <h1 className="dashboard-header__title">{truncateAddress(address)}</h1>
            <p className="dashboard-header__address" title={address}>
              {address}
            </p>
          </div>
          <button
            type="button"
            className="dashboard-header__refresh"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="dashboard-header__stats">
          <div className="dashboard-stat">
            <span className="dashboard-stat__value">
              {balanceLoading ? "…" : formatUsdc(balance ?? 0)}
            </span>
            <span className="dashboard-stat__label">USDC balance</span>
          </div>
          <div className="dashboard-stat">
            <span className="dashboard-stat__value">{stats.activeCount}</span>
            <span className="dashboard-stat__label">Active bets</span>
          </div>
          <div className="dashboard-stat">
            <span className="dashboard-stat__value">
              {formatUsdc(Number(lamportsToUsdc(stats.activeStake)))}
            </span>
            <span className="dashboard-stat__label">In escrow</span>
          </div>
          <div className="dashboard-stat">
            <span className="dashboard-stat__value">{stats.claimableCount}</span>
            <span className="dashboard-stat__label">Ready to claim</span>
          </div>
        </div>

        <p className="dashboard-header__network">
          {network === "mainnet-beta" ? "Mainnet" : "Devnet"} · positions loaded
          from on-chain escrow
        </p>
      </header>

      {error && (
        <p className="dashboard-error" role="alert">
          {error}
        </p>
      )}

      {stats.claimableCount > 0 && (
        <div className="dashboard-alert">
          You have{" "}
          <strong>
            ~{formatUsdc(Number(lamportsToUsdc(stats.claimableValue)))} USDC
          </strong>{" "}
          in claimable winnings across {stats.claimableCount} bet
          {stats.claimableCount === 1 ? "" : "s"}.
        </div>
      )}

      <section className="dashboard-bets">
        <div className="dashboard-bets__head">
          <h2 className="dashboard-bets__title">Your positions</h2>
          <p className="dashboard-bets__sub">
            {bets.length === 0
              ? "No on-chain bets yet — stake USDC on any open market."
              : `${bets.length} position${bets.length === 1 ? "" : "s"} for this wallet`}
          </p>
        </div>

        {loading && bets.length === 0 ? (
          <div className="card p-8 text-center text-sm text-[var(--muted)]">
            Loading your on-chain positions…
          </div>
        ) : bets.length === 0 ? (
          <div className="card dashboard-empty-inline p-8 text-center">
            <p className="text-sm text-[var(--muted)]">
              Place your first bet from the markets page. Each stake creates a
              Position account tied to this wallet.
            </p>
            <Link href="/markets" className="dashboard-empty__cta inline-block mt-4">
              Browse markets
            </Link>
          </div>
        ) : (
          <div className="dashboard-bets__list">
            {bets.map((bet) => (
              <DashboardBetRow
                key={bet.position.pubkey.toBase58()}
                bet={bet}
                onClaimed={() => void refresh()}
              />
            ))}
          </div>
        )}
      </section>

      {(stats.lostCount > 0 || stats.wonCount > 0) && (
        <section className="dashboard-summary card p-5">
          <h2 className="text-sm font-semibold">History summary</h2>
          <div className="dashboard-summary__grid">
            <span>{stats.wonCount} claimed win{stats.wonCount === 1 ? "" : "s"}</span>
            <span>{stats.lostCount} settled loss{stats.lostCount === 1 ? "" : "es"}</span>
          </div>
        </section>
      )}
    </div>
  );
}
