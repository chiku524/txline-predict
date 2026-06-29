"use client";

import { useCallback, useEffect, useState } from "react";
import type { SharpMovementSignal } from "@txline-predict/txline-client";
import Link from "next/link";

interface MonitorResponse {
  agent: string;
  description: string;
  threshold: string;
  pollIntervalSec: number;
  signals: SharpMovementSignal[];
  lastPollAt: string | null;
  pollCount: number;
  marketsTracked?: number;
  newSignals?: number;
  error?: string;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function severityClass(severity: SharpMovementSignal["severity"]): string {
  if (severity === "major") return "sharp-signal--major";
  if (severity === "sharp") return "sharp-signal--sharp";
  return "sharp-signal--minor";
}

export function SharpMovementAgent() {
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/sharp-movements");
      const json = (await res.json()) as MonitorResponse;
      if (!res.ok) throw new Error(json.error ?? "Monitor unavailable");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Autonomous agent
          </p>
          <h2 className="text-lg font-bold">Sharp Movement Detector</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Polls TxLINE odds every 60 seconds and flags implied-probability
            shifts ≥ 3% — the kind of line moves sharp bettors react to before
            kickoff.
          </p>
        </div>
        <span className="badge badge-open">Running</span>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg nested-glass px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Poll cycles</p>
          <p className="text-xl font-semibold">{data?.pollCount ?? "—"}</p>
        </div>
        <div className="rounded-lg nested-glass px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Markets tracked</p>
          <p className="text-xl font-semibold">{data?.marketsTracked ?? "—"}</p>
        </div>
        <div className="rounded-lg nested-glass px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Last poll</p>
          <p className="text-sm font-semibold">
            {data?.lastPollAt
              ? new Date(data.lastPollAt).toLocaleTimeString()
              : "—"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Starting first odds poll…</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && data?.signals.length === 0 && (
        <p className="rounded-lg nested-glass px-4 py-3 text-sm text-[var(--muted)]">
          No sharp moves detected yet. The agent needs at least two poll cycles
          to compare odds. Leave this page open — it auto-refreshes every 60s.
        </p>
      )}

      {data && data.signals.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.signals.map((signal) => (
            <li
              key={signal.id}
              className={`sharp-signal rounded-lg nested-glass px-4 py-3 ${severityClass(signal.severity)}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {signal.homeTeam} vs {signal.awayTeam}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {signal.marketType.replace(/_/g, " ")} · {signal.outcomeLabel}
                  </p>
                </div>
                <span className="badge badge-open uppercase">{signal.severity}</span>
              </div>
              <p className="mt-2 text-sm">
                Implied{" "}
                <strong>{formatPct(signal.previousImplied)}</strong>
                {" → "}
                <strong>{formatPct(signal.currentImplied)}</strong>
                {" "}
                <span className={signal.direction === "up" ? "text-emerald-400" : "text-amber-400"}>
                  ({signal.direction === "up" ? "+" : ""}
                  {(signal.delta * 100).toFixed(1)} pts)
                </span>
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Detected {new Date(signal.detectedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="bet-panel__ghost text-sm"
          onClick={() => void refresh()}
        >
          Poll now
        </button>
        <Link href="/markets" className="bet-panel__link text-sm">
          Bet on open markets →
        </Link>
      </div>
    </div>
  );
}
