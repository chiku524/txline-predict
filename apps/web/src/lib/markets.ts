import type { PredictionMarket } from "@txline-predict/txline-client";
import {
  buildMarketsFromFixtures,
  fetchOddsForFixtures,
} from "@txline-predict/txline-client";
import { groupByCompetition, isHeroCompetition, partitionByHero } from "./competitions";
import { DEMO_MARKETS } from "./demo-data";
import { getFixtures, isDemoMode } from "./txline";

const apiToken = process.env.TXLINE_API_TOKEN ?? "";

export async function getMarkets(): Promise<PredictionMarket[]> {
  if (isDemoMode()) return DEMO_MARKETS;

  try {
    const fixtures = await getFixtures();
    const oddsByFixture = await fetchOddsForFixtures(
      { apiToken },
      fixtures.map((f) => f.fixtureId)
    );
    const markets = buildMarketsFromFixtures(fixtures, oddsByFixture);
    return markets.length > 0 ? markets : DEMO_MARKETS;
  } catch {
    return DEMO_MARKETS;
  }
}

export async function getMarketsGrouped(): Promise<{
  hero: PredictionMarket[];
  other: { name: string; items: PredictionMarket[] }[];
  all: PredictionMarket[];
}> {
  const all = await getMarkets();
  const { hero, other } = partitionByHero(all);
  return {
    all,
    hero,
    other: groupByCompetition(other),
  };
}

export async function getFeaturedMarkets(limit = 4): Promise<PredictionMarket[]> {
  const markets = await getMarkets();
  const hero = markets.filter(isHeroCompetition);
  const pool = hero.length > 0 ? hero : markets;
  return pool.slice(0, limit);
}

export async function getSecondaryMarkets(limit = 4): Promise<PredictionMarket[]> {
  const markets = await getMarkets();
  return markets.filter((m) => !isHeroCompetition(m)).slice(0, limit);
}
