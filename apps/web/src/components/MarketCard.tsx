"use client";

import { useState } from "react";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { BetPanel } from "@/components/BetPanel";
import { lamportsToUsdc } from "@/lib/demo-data";
import {
  formatKickoff,
  formatOdds,
  formatUsdc,
} from "@/lib/betting";

function MarketStatus({ status }: { status: PredictionMarket["status"] }) {
  const map = {
    open: { className: "badge-open", label: "Open" },
    locked: { className: "badge-locked", label: "Locked" },
    resolved: { className: "badge-resolved", label: "Settled" },
    cancelled: { className: "badge-live", label: "Cancelled" },
  } as const;
  const { className, label } = map[status];
  return <span className={`badge ${className}`}>{label}</span>;
}

function marketTypeLabel(type: PredictionMarket["type"]): string {
  if (type === "match_winner") return "Match winner";
  if (type === "total_goals") return "Total goals";
  return type;
}

export function MarketCard({ market }: { market: PredictionMarket }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const poolUsdc = lamportsToUsdc(market.totalPoolLamports);
  const canBet = market.status === "open";
  const selected =
    selectedIndex != null ? market.outcomes[selectedIndex] : null;

  return (
    <article className="market-card">
      <header className="market-card__header">
        <div className="min-w-0 flex-1">
          <p className="market-card__type">{marketTypeLabel(market.type)}</p>
          <h3 className="market-card__title">{market.title}</h3>
          <p className="market-card__fixture">
            {market.homeTeam} vs {market.awayTeam}
          </p>
          <p className="market-card__kickoff">{formatKickoff(market.kickoffUtc)}</p>
        </div>
        <MarketStatus status={market.status} />
      </header>

      <div className="market-card__pool">
        <span className="market-card__pool-label">Total pool</span>
        <span className="market-card__pool-value">
          {formatUsdc(Number(poolUsdc))} USDC
        </span>
      </div>

      <div className="market-card__outcomes" role="list">
        {market.outcomes.map((o, index) => {
          const poolPct =
            market.totalPoolLamports > 0
              ? Math.round((o.poolLamports / market.totalPoolLamports) * 100)
              : 0;
          const isWinner = market.resolvedOutcomeId === o.id;
          const isSelected = selectedIndex === index;
          const odds = formatOdds(o.impliedProbability);

          return (
            <button
              key={o.id}
              type="button"
              role="listitem"
              disabled={!canBet}
              onClick={() =>
                setSelectedIndex((prev) => (prev === index ? null : index))
              }
              className={[
                "outcome-option",
                isWinner && "outcome-option--winner",
                isSelected && "outcome-option--selected",
                !canBet && "outcome-option--disabled",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="outcome-option__top">
                <span className="outcome-option__label">{o.label}</span>
                <div className="outcome-option__odds">
                  <span className="outcome-option__odds-value">{odds}x</span>
                  {o.impliedProbability != null && (
                    <span className="outcome-option__prob">
                      {(o.impliedProbability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="outcome-option__bar-track" aria-hidden>
                <div
                  className="outcome-option__bar-fill"
                  style={{ width: `${Math.max(poolPct, 4)}%` }}
                />
              </div>
              <div className="outcome-option__footer">
                <span>{poolPct}% of pool</span>
                {canBet && (
                  <span className="outcome-option__cta">
                    {isSelected ? "Selected" : "Tap to bet"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {canBet && selected && selectedIndex != null && (
        <BetPanel
          market={market}
          outcomeIndex={selectedIndex}
          label={selected.label}
          impliedProbability={selected.impliedProbability}
          onCancel={() => setSelectedIndex(null)}
        />
      )}

      {!canBet && market.status === "locked" && (
        <p className="market-card__notice">
          Betting closed — kicks off soon or match in progress.
        </p>
      )}

      {market.proof && (
        <div className="market-card__proof">
          <div className="font-semibold text-[var(--accent)]">
            TxLINE verification receipt
          </div>
          <div className="mt-1 break-all font-mono text-[var(--muted)]">
            root: {market.proof.root.slice(0, 24)}…
          </div>
        </div>
      )}
    </article>
  );
}
