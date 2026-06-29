"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUsdc, explorerTxUrl } from "@/lib/betting";
import { lamportsToUsdc } from "@/lib/demo-data";

interface ArenaBet {
  id: string;
  agentId: "momentum" | "contrarian";
  fixtureId: string;
  marketType: string;
  outcomeLabel: string;
  stakeLamports: number;
  reason: string;
  txSig: string | null;
  ok: boolean;
  error: string | null;
  placedAt: string;
}

interface ArenaResponse {
  agent: string;
  description: string;
  scoreboard: { momentum: number; contrarian: number };
  bets: ArenaBet[];
  lastRunAt: string | null;
  runCount: number;
  lastError: string | null;
  agentPubkeys: { momentum: string; contrarian: string };
  newBets?: number;
  signalsProcessed?: number;
  error?: string;
}

const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

export function AgentArena() {
  const [data, setData] = useState<ArenaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/arena");
      const json = (await res.json()) as ArenaResponse;
      if (!res.ok) throw new Error(json.error ?? "Arena unavailable");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load arena");
    } finally {
      setLoading(false);
    }
  }, []);

  const runCycle = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/agents/arena", { method: "POST" });
      const json = (await res.json()) as ArenaResponse;
      if (!res.ok) throw new Error(json.error ?? "Arena run failed");
      setData((prev) => ({ ...prev, ...json, bets: json.bets }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Arena run failed");
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 90_000);
    return () => clearInterval(id);
  }, [refresh]);

  const momentumStaked = data
    ? Number(lamportsToUsdc(data.scoreboard.momentum))
    : 0;
  const contrarianStaked = data
    ? Number(lamportsToUsdc(data.scoreboard.contrarian))
    : 0;

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Agent vs agent
          </p>
          <h2 className="text-lg font-bold">Strategy Arena</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            <strong className="text-white">Momentum</strong> follows sharp TxLINE
            line moves; <strong className="text-white">Contrarian</strong> fades
            them into the best alternative outcome. Both stake USDC on devnet when
            the Sharp Movement Detector fires.
          </p>
        </div>
        <button
          type="button"
          className="bet-panel__primary text-sm"
          disabled={running}
          onClick={() => void runCycle()}
        >
          {running ? "Running…" : "Run arena cycle"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg nested-glass px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Momentum agent</p>
          <p className="text-xl font-semibold text-emerald-400">
            {formatUsdc(momentumStaked)} USDC staked
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]">
            {data?.agentPubkeys.momentum ?? "—"}
          </p>
        </div>
        <div className="rounded-lg nested-glass px-4 py-3">
          <p className="text-xs text-[var(--muted)]">Contrarian agent</p>
          <p className="text-xl font-semibold text-amber-400">
            {formatUsdc(contrarianStaked)} USDC staked
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-[var(--muted)]">
            {data?.agentPubkeys.contrarian ?? "—"}
          </p>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-[var(--muted)]">Loading arena state…</p>
      )}
      {(error || data?.lastError) && (
        <p className="mb-3 text-sm text-red-400">{error ?? data?.lastError}</p>
      )}

      <p className="mb-3 rounded-lg nested-glass px-4 py-3 text-xs text-[var(--muted)]">
        <strong className="text-white">Fund agents (automated):</strong> agent
        keypairs are saved in{" "}
        <code className="text-[10px]">platform/agent-momentum.json</code> and{" "}
        <code className="text-[10px]">platform/agent-contrarian.json</code>{" "}
        (created when you first open this page). From the repo root, run:
        <br />
        <code className="mt-2 block text-[11px] text-[var(--accent)]">
          npm run devnet:fund && npm run devnet:fund-agents
        </code>
        That sends SOL + USDC from your platform wallet to both agents.
        <br />
        <strong className="mt-2 inline-block text-white">Manual option:</strong>{" "}
        copy each address below →{" "}
        <a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bet-panel__link"
        >
          faucet.solana.com
        </a>{" "}
        (SOL) and{" "}
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="bet-panel__link"
        >
          faucet.circle.com
        </a>{" "}
        (USDC, Solana Devnet).
      </p>

      {data && data.bets.length === 0 && !loading && (
        <p className="rounded-lg nested-glass px-4 py-3 text-sm text-[var(--muted)]">
          No arena bets yet. Sharp signals will trigger autonomous opposing
          stakes on the next cycle.
        </p>
      )}

      {data && data.bets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.bets.map((bet) => (
            <li
              key={bet.id}
              className="rounded-lg nested-glass px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold capitalize">{bet.agentId}</span>
                <span className={bet.ok ? "text-emerald-400" : "text-red-400"}>
                  {bet.ok ? "On-chain" : "Failed"}
                </span>
              </div>
              <p className="mt-1">
                {formatUsdc(Number(lamportsToUsdc(bet.stakeLamports)))} USDC on{" "}
                <strong>{bet.outcomeLabel}</strong> · fixture {bet.fixtureId}
              </p>
              <p className="text-xs text-[var(--muted)]">{bet.reason}</p>
              {bet.error && (
                <p className="mt-1 text-xs text-red-400">{bet.error}</p>
              )}
              {bet.txSig && (
                <a
                  href={explorerTxUrl(bet.txSig, network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bet-panel__link mt-1 inline-block text-xs"
                >
                  View tx →
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      {data?.lastRunAt && (
        <p className="mt-3 text-[10px] text-[var(--muted)]">
          Last run {new Date(data.lastRunAt).toLocaleString()} ·{" "}
          {data.runCount} cycles
        </p>
      )}
    </div>
  );
}
