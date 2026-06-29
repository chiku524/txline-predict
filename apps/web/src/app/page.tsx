import type { Metadata } from "next";
import Link from "next/link";
import { LiveFeed } from "@/components/LiveFeed";
import { MarketCard } from "@/components/MarketCard";
import { MarketSection } from "@/components/MarketSection";
import { OutcomeColorLegend } from "@/components/OutcomeColorLegend";
import { WorldCupHero } from "@/components/WorldCupHero";
import {
  heroCompetitionLabel,
  partitionByHero,
} from "@/lib/competitions";
import {
  getFeaturedMarkets,
  getMarkets,
  getSecondaryMarkets,
} from "@/lib/markets";
import { getFixtures } from "@/lib/txline";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Home",
  description:
    "Trade World Cup prediction markets on Solana with live TxLINE match data, transparent odds, and verifiable settlement.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const [fixtures, featured, secondary, allMarkets] = await Promise.all([
    getFixtures(),
    getFeaturedMarkets(4),
    getSecondaryMarkets(2),
    getMarkets(),
  ]);

  const { hero: heroFixtures } = partitionByHero(fixtures);
  const { hero: heroMarkets } = partitionByHero(allMarkets);
  const heroName = heroCompetitionLabel(fixtures, allMarkets);

  return (
    <div className="space-y-14">
      <WorldCupHero
        competitionName={heroName}
        heroFixtures={heroFixtures}
        heroMarkets={heroMarkets}
      />

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "TxLINE data layer",
            body: "SSE streams for scores, odds, and fixtures with a single normalised JSON schema across competitions.",
          },
          {
            title: "USDC escrow pools",
            body: "Peer-to-peer wagering pools held in Anchor program PDAs — no TxLINE token for P2P transfers.",
          },
          {
            title: "Verifiable settlement",
            body: "CPI into TxLINE validate_stat with Merkle proofs; winners claim trustlessly after full-time.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="mb-2 font-semibold">{f.title}</h2>
            <p className="text-sm text-[var(--muted)]">{f.body}</p>
          </div>
        ))}
      </section>

      <MarketSection
        badge="Featured"
        title={`${heroName} markets`}
        description="Auto-generated from live TxLINE fixtures and consensus odds."
        markets={featured}
      />

      <OutcomeColorLegend compact />

      {secondary.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                More from TxLINE
              </p>
              <h2 className="text-xl font-bold">Other competitions</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Same verifiable market engine — additional leagues in your subscription.
              </p>
            </div>
            <Link
              href="/markets"
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              View all markets →
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {secondary.map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LiveFeed />
        </div>
        <div className="card flex flex-col justify-center gap-4 p-6">
          <h2 className="text-lg font-bold">Ready to bet?</h2>
          <p className="text-sm text-[var(--muted)]">
            Connect your wallet on devnet, pick an outcome, and stake USDC in the
            on-chain escrow pool.
          </p>
          <Link
            href="/markets"
            className="inline-flex justify-center rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#04120e]"
          >
            Browse all markets
          </Link>
        </div>
      </section>
    </div>
  );
}
