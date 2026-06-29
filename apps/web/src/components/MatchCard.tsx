import type { TxLineFixture } from "@txline-predict/txline-client";
import { formatKickoff } from "@/lib/betting";

function StatusBadge({ status }: { status: TxLineFixture["status"] }) {
  if (status === "live") {
    return (
      <span className="badge badge-live">
        <span className="pulse-dot" />
        Live
      </span>
    );
  }
  if (status === "finished") {
    return <span className="badge badge-resolved">FT</span>;
  }
  return <span className="badge badge-open">{status}</span>;
}

export function MatchCard({ fixture }: { fixture: TxLineFixture }) {
  return (
    <article className="card p-5 transition hover:border-[var(--accent)]/40">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted)]">
          {fixture.competitionName ?? "World Cup"}
        </span>
        <StatusBadge status={fixture.status} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-right">
          <div className="text-lg font-semibold">{fixture.homeTeam}</div>
        </div>
        <div className="nested-glass rounded-xl px-4 py-2 text-center">
          <div className="text-2xl font-bold tabular-nums">
            {fixture.homeScore ?? 0} : {fixture.awayScore ?? 0}
          </div>
          {fixture.phase && (
            <div className="text-xs text-[var(--muted)]">{fixture.phase}</div>
          )}
        </div>
        <div className="flex-1">
          <div className="text-lg font-semibold">{fixture.awayTeam}</div>
        </div>
      </div>
      <div className="mt-4 text-center text-xs text-[var(--muted)]">
        {formatKickoff(fixture.kickoffUtc)}
      </div>
    </article>
  );
}
