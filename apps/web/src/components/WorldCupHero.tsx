"use client";

import Link from "next/link";
import type { PredictionMarket, TxLineFixture } from "@txline-predict/txline-client";
import { useTxLineLiveStats } from "@/hooks/useTxLineLiveStats";
import { countLive, countOpenMarkets } from "@/lib/competitions";

interface WorldCupHeroProps {
  competitionName: string;
  heroFixtures: TxLineFixture[];
  heroMarkets: PredictionMarket[];
}

export function WorldCupHero({
  competitionName,
  heroFixtures,
  heroMarkets,
}: WorldCupHeroProps) {
  const initialLive = countLive(heroFixtures);
  const openMarkets = countOpenMarkets(heroMarkets);
  const upcoming = heroFixtures.filter((f) => f.status === "scheduled").length;
  const heroFixtureIds = heroFixtures.map((f) => f.fixtureId);
  const initialLiveFixtureIds = heroFixtures
    .filter((f) => f.status === "live")
    .map((f) => f.fixtureId);

  const { live, lastUpdate } = useTxLineLiveStats({
    heroFixtureIds,
    initialLiveFixtureIds,
    initialLive,
  });

  return (
    <section className="wc-hero">
      <div className="wc-hero__glow" aria-hidden />
      <div className="wc-hero__content">
        <p className="wc-hero__eyebrow">
          <span className="wc-hero__live-dot" aria-hidden />
          {live > 0 ? "Matches live now" : "Now live on TxLINE"}
        </p>
        <h1 className="wc-hero__title">{competitionName}</h1>
        <p className="wc-hero__subtitle">
          Verifiable prediction markets powered by real-time TxLINE odds and
          scores. Bet USDC on match outcomes — settled on-chain with Merkle proofs.
        </p>
        <div className="wc-hero__stats">
          <div className="wc-hero__stat">
            <span className="wc-hero__stat-value">{live}</span>
            <span className="wc-hero__stat-label">Live now</span>
          </div>
          <div className="wc-hero__stat">
            <span className="wc-hero__stat-value">{openMarkets}</span>
            <span className="wc-hero__stat-label">Open markets</span>
          </div>
          <div className="wc-hero__stat">
            <span className="wc-hero__stat-value">{upcoming}</span>
            <span className="wc-hero__stat-label">Upcoming</span>
          </div>
        </div>
        {lastUpdate && (
          <p className="wc-hero__live-hint">
            Stats refreshed from TxLINE scores stream
          </p>
        )}
        <div className="wc-hero__actions">
          <Link href="/markets" className="wc-hero__cta wc-hero__cta--primary">
            World Cup markets
          </Link>
          <Link href="/matches" className="wc-hero__cta wc-hero__cta--ghost">
            Live scores
          </Link>
        </div>
      </div>
    </section>
  );
}
