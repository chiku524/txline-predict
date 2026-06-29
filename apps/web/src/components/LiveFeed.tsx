"use client";

import { useEffect, useState } from "react";
import { useTxLineStream } from "@/hooks/TxLineStreamProvider";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(formatTime(iso));
  }, [iso]);

  return <span suppressHydrationWarning>{label || "—"}</span>;
}

export function LiveFeed() {
  const { events, connected } = useTxLineStream();

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">TxLINE live feed</h3>
        <span className={`badge ${connected ? "badge-open" : "badge-locked"}`}>
          {connected ? "Live SSE" : "Reconnecting"}
        </span>
      </div>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {events.length === 0 ? (
          <li className="rounded-lg nested-glass px-3 py-2 text-xs text-[var(--muted)]">
            Connecting to TxLINE…
          </li>
        ) : (
          events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-lg nested-glass px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--muted)]">
                <span className="uppercase text-[var(--accent)]">{ev.type}</span>
                <EventTime iso={ev.at} />
              </div>
              {ev.message}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
