import type { Metadata } from "next";
import { AgentArena } from "@/components/AgentArena";
import { SharpMovementAgent } from "@/components/SharpMovementAgent";
import { LiveFeed } from "@/components/LiveFeed";
export const metadata: Metadata = {
  title: "Agents · TxLINE Predict",
  description:
    "Autonomous TxLINE agents — sharp odds movement detection powered by live feeds.",
};

export default function AgentsPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
          TxLINE agents track
        </p>
        <h1 className="mt-1 text-2xl font-bold">Autonomous market intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          TxLINE Predict doubles as an agent host: tools ingest live odds and
          scores, run programmatic strategies without manual input, and surface
          signals you can act on in the betting markets.
        </p>
      </section>

      <SharpMovementAgent />

      <AgentArena />

      <section className="card p-6">
        <h2 className="text-base font-semibold">Agents track checklist</h2>
        <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
          <li>
            <strong className="text-white">Live TxLINE input</strong> — odds
            snapshot + SSE streams
          </li>
          <li>
            <strong className="text-white">Autonomous operation</strong> — sharp
            detector polls every 60s; arena reacts to signals
          </li>
          <li>
            <strong className="text-white">On-chain settlement</strong> — agent
            stakes use the same devnet parimutuel program as manual bets
          </li>
          <li>
            Judge APIs:{" "}
            <code className="text-xs">/api/agents/sharp-movements</code>,{" "}
            <code className="text-xs">/api/agents/arena</code>
          </li>
        </ul>
      </section>

      <LiveFeed />    </div>
  );
}
