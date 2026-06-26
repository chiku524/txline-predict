import { MarketCard } from "@/components/MarketCard";
import { DEMO_MARKETS } from "@/lib/demo-data";

export default function MarketsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Prediction markets</h1>
        <p className="mt-2 text-[var(--muted)]">
          Auto-generated markets for match winner, totals, and props — resolved
          trustlessly when TxLINE publishes verified final scores.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DEMO_MARKETS.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
