import { MarketCard } from "@/components/MarketCard";
import { getMarkets } from "@/lib/markets";
import { isDemoMode } from "@/lib/txline";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const markets = await getMarkets();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Prediction markets</h1>
        <p className="mt-2 text-[var(--muted)]">
          {isDemoMode()
            ? "Demo markets — configure TXLINE_API_TOKEN for live auto-generation."
            : `${markets.length} markets auto-generated from TxLINE fixtures and consensus odds.`}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
