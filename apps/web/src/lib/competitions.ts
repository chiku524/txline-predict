import type { PredictionMarket, TxLineFixture } from "@txline-predict/txline-client";

const HERO_NAME_KEYWORDS = ["world cup", "fifa"];

/** Primary competition for hero rails (World Cup by default). */
export function isHeroCompetition(item: {
  competitionId: number;
  competitionName?: string;
}): boolean {
  const idOverride = process.env.NEXT_PUBLIC_HERO_COMPETITION_ID;
  if (idOverride && String(item.competitionId) === idOverride) return true;
  const name = (item.competitionName ?? "").toLowerCase();
  return HERO_NAME_KEYWORDS.some((k) => name.includes(k));
}

export function partitionByHero<T extends { competitionId: number; competitionName?: string }>(
  items: T[]
): { hero: T[]; other: T[] } {
  const hero: T[] = [];
  const other: T[] = [];
  for (const item of items) {
    (isHeroCompetition(item) ? hero : other).push(item);
  }
  return { hero, other };
}

export function groupByCompetition<T extends { competitionName?: string }>(
  items: T[]
): { name: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.competitionName?.trim() || "Other competitions";
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, groupItems]) => ({ name, items: groupItems }));
}

export function heroCompetitionLabel(
  fixtures: TxLineFixture[],
  markets: PredictionMarket[]
): string {
  const heroFixture = fixtures.find(isHeroCompetition);
  if (heroFixture?.competitionName) return heroFixture.competitionName;
  const heroMarket = markets.find(isHeroCompetition);
  return heroMarket?.competitionName ?? "FIFA World Cup 2026";
}

export function countLive(items: TxLineFixture[]): number {
  return items.filter((f) => f.status === "live").length;
}

export function countOpenMarkets(markets: PredictionMarket[]): number {
  return markets.filter((m) => m.status === "open").length;
}
