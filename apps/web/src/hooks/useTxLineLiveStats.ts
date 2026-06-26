"use client";

import { useEffect, useState } from "react";

interface LiveStats {
  live: number;
  lastUpdate: string | null;
}

interface UseTxLineLiveStatsOptions {
  heroFixtureIds: string[];
  initialLiveFixtureIds: string[];
  initialLive: number;
}

export function useTxLineLiveStats({
  heroFixtureIds,
  initialLiveFixtureIds,
  initialLive,
}: UseTxLineLiveStatsOptions): LiveStats {
  const [liveIds, setLiveIds] = useState<Set<string>>(
    () => new Set(initialLiveFixtureIds)
  );
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    setLiveIds(new Set(initialLiveFixtureIds));
  }, [initialLiveFixtureIds.join(",")]);

  useEffect(() => {
    const heroSet = new Set(heroFixtureIds);
    if (heroSet.size === 0) return;

    const es = new EventSource("/api/txline/stream");

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as {
          type?: string;
          fixtureId?: string;
          isLive?: boolean;
        };
        if (data.type !== "score" || !data.fixtureId) return;
        if (!heroSet.has(data.fixtureId)) return;

        setLiveIds((prev) => {
          const next = new Set(prev);
          if (data.isLive === false) {
            next.delete(data.fixtureId!);
          } else {
            next.add(data.fixtureId!);
          }
          return next;
        });
        setLastUpdate(new Date().toISOString());
      } catch {
        /* ignore */
      }
    };

    return () => es.close();
  }, [heroFixtureIds.join(",")]);

  const sseLive = liveIds.size;
  const live = Math.max(initialLive, sseLive);

  return { live, lastUpdate };
}
