import { MarketCard } from "@/components/MarketCard";
import type { PredictionMarket } from "@txline-predict/txline-client";

interface MarketSectionProps {
  title: string;
  description?: string;
  markets: PredictionMarket[];
  badge?: string;
}

export function MarketSection({
  title,
  description,
  markets,
  badge,
}: MarketSectionProps) {
  if (markets.length === 0) return null;

  return (
    <section className="market-section">
      <div className="market-section__header">
        <div>
          {badge && <span className="market-section__badge">{badge}</span>}
          <h2 className="market-section__title">{title}</h2>
          {description && (
            <p className="market-section__desc">{description}</p>
          )}
        </div>
        <span className="market-section__count">
          {markets.length} market{markets.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="market-section__grid">
        {markets.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </section>
  );
}
