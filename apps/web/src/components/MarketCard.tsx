"use client";

import { useState } from "react";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { BetModal } from "@/components/BetModal";
import { MarketActions } from "@/components/MarketActions";
import { lamportsToUsdc } from "@/lib/demo-data";
import {
  formatKickoff,
  formatOdds,
  formatUsdc,
} from "@/lib/betting";
import { outcomeToneClass } from "@/lib/outcome-colors";

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
  if (type === "both_teams_score") return "Both teams score";
  return type;
}

export function MarketCard({
  market,
  showCompetition = false,
}: {
  market: PredictionMarket;
  showCompetition?: boolean;
}) {
  const [betOpen, setBetOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const poolUsdc = lamportsToUsdc(market.totalPoolLamports);
  const canBet = market.status === "open";

  const openBet = (index: number) => {
    setSelectedIndex(index);
    setBetOpen(true);
  };

  const closeBet = () => {
    setBetOpen(false);
    setSelectedIndex(null);
  };

  return (
    <>
      <article className="market-card">
        <header className="market-card__header">
          <div className="min-w-0 flex-1">
            <p className="market-card__type">
            {marketTypeLabel(market.type)}
            {showCompetition && market.competitionName && (
              <span className="market-card__competition">
                · {market.competitionName}
              </span>
            )}
          </p>
            <h3 className="market-card__title">
              {market.homeTeam} vs {market.awayTeam}
            </h3>
            <p className="market-card__kickoff">
              {formatKickoff(market.kickoffUtc)}
            </p>
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
            const odds = formatOdds(o.impliedProbability);

            return (
              <button
                key={o.id}
                type="button"
                role="listitem"
                disabled={!canBet}
                onClick={() => canBet && openBet(index)}
                className={[
                  "outcome-option",
                  outcomeToneClass(o.id),
                  isWinner && "outcome-option--winner",
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
                    <span className="outcome-option__cta">Bet →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

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
            {market.proof.validatedAt && (
              <div className="mt-1 text-[10px] text-[var(--muted)]">
                Validated {new Date(market.proof.validatedAt).toLocaleString()}
              </div>
            )}
          </div>
        )}

        <MarketActions market={market} />
      </article>

      {selectedIndex != null && (
        <BetModal
          open={betOpen}
          market={market}
          outcomeIndex={selectedIndex}
          onClose={closeBet}
        />
      )}
    </>
  );
}
