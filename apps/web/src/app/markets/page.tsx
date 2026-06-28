import { MarketsBrowser } from "@/components/MarketsBrowser";
import { OutcomeColorLegend } from "@/components/OutcomeColorLegend";
import { WorldCupHero } from "@/components/WorldCupHero";
import { heroCompetitionLabel, partitionByHero } from "@/lib/competitions";
import { getMarketsGrouped } from "@/lib/markets";
import { getFixtures, isDemoMode } from "@/lib/txline";

export const revalidate = 60;

const STEPS = [
  {
    title: "Pick an outcome",
    body: "Tap a team or line — a bet slip modal opens with live odds and match details.",
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
  const [fixtures, grouped] = await Promise.all([
    getFixtures(),
    getMarketsGrouped(),
  ]);

  const { hero: heroFixtures } = partitionByHero(fixtures);
  const heroName = heroCompetitionLabel(fixtures, grouped.all);

  return (
    <div className="space-y-10">
      <WorldCupHero
        competitionName={heroName}
        heroFixtures={heroFixtures}
        heroMarkets={grouped.hero}
      />

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

      <MarketsBrowser
        heroName={heroName}
        heroMarkets={grouped.hero}
        otherGroups={grouped.other}
        demoMode={isDemoMode()}
      />

      <OutcomeColorLegend />
    </div>
  );
}
