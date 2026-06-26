"use client";

import { useEffect, useState } from "react";

interface FeedEvent {
  id: string;
  type: "score" | "odds" | "status";
  message: string;
  at: string;
}

const DEMO_EVENTS: FeedEvent[] = [
  {
    id: "1",
    type: "odds",
    message: "Brazil vs Germany — home implied 42% → 43%",
    at: new Date().toISOString(),
  },
  {
    id: "2",
    type: "score",
    message: "Argentina 1-1 France — GOAL 67' (Messi)",
    at: new Date().toISOString(),
  },
  {
    id: "3",
    type: "status",
    message: "Spain vs England — match finished 2-1",
    at: new Date().toISOString(),
  },
];

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(DEMO_EVENTS);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/txline/stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as { message: string; type: FeedEvent["type"] };
        setEvents((prev) => [
          {
            id: crypto.randomUUID(),
            type: data.type ?? "status",
            message: data.message,
            at: new Date().toISOString(),
          },
          ...prev.slice(0, 19),
        ]);
      } catch {
        /* demo heartbeat */
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
          {connected ? "SSE connected" : "Demo mode"}
        </span>
      </div>
      <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs"
          >
            <span className="mr-2 uppercase text-[var(--accent)]">{ev.type}</span>
            {ev.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
