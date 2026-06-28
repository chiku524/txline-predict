import { MatchCard } from "@/components/MatchCard";
import { LiveFeed } from "@/components/LiveFeed";
import { WorldCupHero } from "@/components/WorldCupHero";
import {
  groupByCompetition,
  heroCompetitionLabel,
  isHeroCompetition,
  partitionByHero,
} from "@/lib/competitions";
import { getMarkets } from "@/lib/markets";
import { getFixtures, isDemoMode } from "@/lib/txline";

export const revalidate = 60;

export default async function MatchesPage() {
  const [fixtures, markets] = await Promise.all([getFixtures(), getMarkets()]);
  const { hero, other } = partitionByHero(fixtures);
  const otherGroups = groupByCompetition(other);
  const heroName = heroCompetitionLabel(fixtures, markets);

  return (
    <div className="space-y-10">
      <WorldCupHero
        competitionName={heroName}
        heroFixtures={hero}
        heroMarkets={markets.filter(isHeroCompetition)}
      />

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            {heroName}
          </p>
          <h2 className="text-2xl font-bold">Fixtures & live scores</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isDemoMode()
              ? "Demo fixtures — set TXLINE_API_TOKEN for live TxLINE data."
              : "Real-time fixtures from TxLINE scores and odds snapshots."}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
            {hero.map((f) => (
              <MatchCard key={f.fixtureId} fixture={f} />
            ))}
          </div>
          <LiveFeed />
        </div>
      </section>

      {otherGroups.map((group) => (
        <section key={group.name} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
              More from TxLINE
            </p>
            <h2 className="text-xl font-bold">{group.name}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((f) => (
              <MatchCard key={f.fixtureId} fixture={f} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
