"use client";

import { useMemo, useState } from "react";
import type { PredictionMarket } from "@txline-predict/txline-client";
import { MarketCard } from "@/components/MarketCard";
import { isHeroCompetition } from "@/lib/competitions";

interface MarketsBrowserProps {
  heroName: string;
  heroMarkets: PredictionMarket[];
  otherGroups: { name: string; items: PredictionMarket[] }[];
  demoMode: boolean;
}

type TabId = "hero" | "all" | string;

export function MarketsBrowser({
  heroName,
  heroMarkets,
  otherGroups,
  demoMode,
}: MarketsBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabId>("hero");

  const tabs = useMemo(() => {
    const items: { id: TabId; label: string; count: number }[] = [
      { id: "hero", label: heroName, count: heroMarkets.length },
      { id: "all", label: "All", count: heroMarkets.length + otherGroups.reduce((n, g) => n + g.items.length, 0) },
    ];
    for (const g of otherGroups) {
      items.push({ id: g.name, label: g.name, count: g.items.length });
    }
    return items;
  }, [heroName, heroMarkets.length, otherGroups]);

  const visibleMarkets = useMemo(() => {
    if (activeTab === "hero") return heroMarkets;
    if (activeTab === "all") {
      return [...heroMarkets, ...otherGroups.flatMap((g) => g.items)];
    }
    const group = otherGroups.find((g) => g.name === activeTab);
    return group?.items ?? [];
  }, [activeTab, heroMarkets, otherGroups]);

  const sectionTitle =
    activeTab === "hero"
      ? heroName
      : activeTab === "all"
        ? "All competitions"
        : activeTab;

  return (
    <div className="markets-browser">
      <div className="markets-browser__tabs" role="tablist" aria-label="Filter by competition">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`markets-browser__tab ${activeTab === tab.id ? "markets-browser__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            <span className="markets-browser__tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="markets-browser__header">
        <div>
          <h2 className="markets-browser__title">{sectionTitle}</h2>
          <p className="markets-browser__desc">
            {demoMode
              ? "Demo markets — configure TXLINE_API_TOKEN for live data."
              : `${visibleMarkets.length} market${visibleMarkets.length === 1 ? "" : "s"} · tap an outcome to bet`}
          </p>
        </div>
      </div>

      {visibleMarkets.length === 0 ? (
        <p className="markets-browser__empty">No markets in this competition yet.</p>
      ) : (
        <div className="markets-browser__grid">
          {visibleMarkets.map((m) => (
            <MarketCard key={m.id} market={m} showCompetition={!isHeroCompetition(m)} />
          ))}
        </div>
      )}
    </div>
  );
}
