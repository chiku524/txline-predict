import { MarketCard } from "@/components/MarketCard";
import { getMarkets } from "@/lib/markets";
import { isDemoMode } from "@/lib/txline";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Pick an outcome",
    body: "Tap the team or line you believe in. Odds come from live TxLINE consensus.",
  },
  {
    title: "Set your stake",
    body: "Use quick amounts or enter a custom USDC stake. Your wallet must be on devnet.",
  },
  {
    title: "Place your bet",
    body: "One confirmation locks USDC in the on-chain escrow pool until settlement.",
  },
] as const;

export default async function MarketsPage() {
  const markets = await getMarkets();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prediction markets</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          {isDemoMode()
            ? "Demo markets — configure TXLINE_API_TOKEN for live auto-generation."
            : `${markets.length} markets from TxLINE fixtures. Tap an outcome, set your stake, and bet in USDC.`}
        </p>
      </div>

      <section className="how-to-bet" aria-label="How to bet">
        {STEPS.map((s, i) => (
          <div key={s.title} className="how-to-bet__step">
            <span className="how-to-bet__num">{i + 1}</span>
            <div>
              <p className="how-to-bet__title">{s.title}</p>
              <p className="how-to-bet__body">{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </div>
  );
}
