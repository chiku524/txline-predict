import { MatchCard } from "@/components/MatchCard";
import { LiveFeed } from "@/components/LiveFeed";
import { getFixtures, isDemoMode } from "@/lib/txline";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const fixtures = await getFixtures();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">World Cup matches</h1>
        <p className="mt-2 text-[var(--muted)]">
          {isDemoMode()
            ? "Showing demo fixtures — set TXLINE_API_TOKEN to stream live TxLINE data."
            : "Live fixtures from TxLINE scores/odds snapshots."}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
          {fixtures.map((f) => (
            <MatchCard key={f.fixtureId} fixture={f} />
          ))}
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
