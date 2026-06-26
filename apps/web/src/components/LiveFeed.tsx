"use client";

import { useEffect, useState } from "react";

interface FeedEvent {
  id: string;
  type: "score" | "odds" | "status";
  message: string;
  fixtureId?: string;
  at: string;
}

const FALLBACK: FeedEvent[] = [
  {
    id: "boot",
    type: "status",
    message: "Connecting to TxLINE…",
    at: new Date().toISOString(),
  },
];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(FALLBACK);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/txline/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as Omit<FeedEvent, "id">;
        setEvents((prev) => [
          {
            id: crypto.randomUUID(),
            type: data.type ?? "status",
            message: data.message,
            fixtureId: data.fixtureId,
            at: data.at ?? new Date().toISOString(),
          },
          ...prev.slice(0, 24),
        ]);
      } catch {
        /* ignore */
      }
    };

    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">TxLINE live feed</h3>
        <span className={`badge ${connected ? "badge-open" : "badge-locked"}`}>
          {connected ? "Live SSE" : "Reconnecting"}
        </span>
      </div>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs"
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
              <span className="uppercase text-[var(--accent)]">{ev.type}</span>
              <span>{formatTime(ev.at)}</span>
            </div>
            {ev.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
