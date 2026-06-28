"use client";

import { useEffect, useState } from "react";
import { useTxLineStream } from "@/hooks/TxLineStreamProvider";

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
  const { subscribe } = useTxLineStream();
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

    return subscribe((data) => {
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
    });
  }, [heroFixtureIds.join(","), subscribe]);

  const sseLive = liveIds.size;
  const live = Math.max(initialLive, sseLive);

  return { live, lastUpdate };
}
