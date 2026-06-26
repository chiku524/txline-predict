import Link from "next/link";
import { LiveFeed } from "@/components/LiveFeed";
import { MarketCard } from "@/components/MarketCard";
import { getFeaturedMarkets } from "@/lib/markets";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await getFeaturedMarkets(4);
  return (
    <div className="space-y-12">
      <section className="py-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--accent)]">
          Superteam Earn × TxLINE Hackathon
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
          Trustless World Cup prediction markets on Solana
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Real-time scores and consensus odds from TxLINE drive market creation,
          live updates, and on-chain settlement via cryptographic Merkle proofs.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/markets"
            className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[#04120e]"
          >
            Browse markets
          </Link>
          <Link
            href="/matches"
            className="rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold"
          >
            Live matches
          </Link>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          {
            title: "TxLINE data layer",
            body: "SSE streams for scores, odds, and fixtures with a single normalised JSON schema across all World Cup matches.",
          },
          {
            title: "USDC escrow pools",
            body: "Peer-to-peer wagering pools held in Anchor program PDAs — no TxLINE token for P2P transfers.",
          },
          {
            title: "Verifiable settlement",
            body: "CPI into TxLINE validate_stat with Merkle proofs; winners claim trustlessly after full-time.",
          },
        ].map((f) => (
          <div key={f.title} className="card p-5">
            <h2 className="mb-2 font-semibold">{f.title}</h2>
            <p className="text-sm text-[var(--muted)]">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-bold">Featured markets</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {featured.slice(0, 2).map((m) => (
              <MarketCard key={m.id} market={m} />
            ))}
          </div>
        </div>
        <LiveFeed />
      </section>
    </div>
  );
}
