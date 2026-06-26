import type { PredictionMarket } from "@txline-predict/txline-client";
import { lamportsToUsdc } from "@/lib/demo-data";

function MarketStatus({ status }: { status: PredictionMarket["status"] }) {
  const map = {
    open: "badge-open",
    locked: "badge-locked",
    resolved: "badge-resolved",
    cancelled: "badge-live",
  } as const;
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export function MarketCard({ market }: { market: PredictionMarket }) {
  return (
    <article className="card flex flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{market.title}</h3>
        <MarketStatus status={market.status} />
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Pool: {lamportsToUsdc(market.totalPoolLamports)} USDC
      </p>
      <div className="flex flex-col gap-2">
        {market.outcomes.map((o) => {
          const pct =
            market.totalPoolLamports > 0
              ? Math.round((o.poolLamports / market.totalPoolLamports) * 100)
              : 0;
          const isWinner = market.resolvedOutcomeId === o.id;
          return (
            <div
              key={o.id}
              className={`rounded-xl border px-3 py-2 ${
                isWinner
                  ? "border-[var(--accent)] bg-[rgba(34,211,166,0.08)]"
                  : "border-[var(--border)] bg-[var(--surface-2)]"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{o.label}</span>
                <span className="text-[var(--muted)]">{pct}% pool</span>
              </div>
              {o.impliedProbability != null && (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  TxLINE implied: {(o.impliedProbability * 100).toFixed(1)}%
                </div>
              )}
            </div>
          );
        })}
      </div>
      {market.status === "open" && (
        <button
          type="button"
          className="mt-4 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-[#04120e] transition hover:bg-[var(--accent-dim)]"
        >
          Place prediction
        </button>
      )}
      {market.proof && (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border)] p-3 text-xs">
          <div className="mb-1 font-semibold text-[var(--accent)]">
            TxLINE verification receipt
          </div>
          <div className="break-all font-mono text-[var(--muted)]">
            root: {market.proof.root.slice(0, 24)}…
          </div>
        </div>
      )}
    </article>
  );
}
