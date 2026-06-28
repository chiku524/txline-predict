import { buildAuthHeaders, getApiBaseUrl, type TxLineClientConfig } from "./config";
import type { TxLineRawOdds } from "./odds";

export interface StreamEndpoints {
  oddsSnapshot: string;
  oddsStream: string;
  scoresSnapshot: string;
  scoresStream: string;
  fixturesSnapshot: string;
}

/** Subscribed TxLINE REST / SSE endpoints (not guest/*). */
export function getStreamEndpoints(config: TxLineClientConfig): StreamEndpoints {
  const base = getApiBaseUrl(config.useDevnet);
  return {
    oddsSnapshot: `${base}/api/odds/snapshot`,
    oddsStream: `${base}/api/odds/stream`,
    scoresSnapshot: `${base}/api/scores/snapshot`,
    scoresStream: `${base}/api/scores/stream`,
    fixturesSnapshot: `${base}/api/fixtures/snapshot`,
  };
}

/** Fetch World Cup fixture snapshot. */
export async function fetchFixturesSnapshot(
  config: TxLineClientConfig
): Promise<unknown> {
  const { fixturesSnapshot } = getStreamEndpoints(config);
  const res = await fetch(fixturesSnapshot, {
    headers: await buildAuthHeaders(config),
  });
  if (!res.ok) {
    throw new Error(`Fixtures snapshot failed: ${res.status}`);
  }
  return res.json();
}

/** Fetch latest odds snapshot. */
export async function fetchOddsSnapshot(
  config: TxLineClientConfig
): Promise<unknown> {
  const { oddsSnapshot } = getStreamEndpoints(config);
  const res = await fetch(oddsSnapshot, {
    headers: await buildAuthHeaders(config),
  });
  if (!res.ok) {
    throw new Error(`Odds snapshot failed: ${res.status}`);
  }
  return res.json();
}

/** Fetch latest scores snapshot. */
export async function fetchScoresSnapshot(
  config: TxLineClientConfig
): Promise<unknown> {
  const { scoresSnapshot } = getStreamEndpoints(config);
  const res = await fetch(scoresSnapshot, {
    headers: await buildAuthHeaders(config),
  });
  if (!res.ok) {
    throw new Error(`Scores snapshot failed: ${res.status}`);
  }
  return res.json();
}

/** Fetch odds snapshot for a single fixture. */
export async function fetchOddsForFixture(
  config: TxLineClientConfig,
  fixtureId: string | number
): Promise<TxLineRawOdds[]> {
  const base = getApiBaseUrl(config.useDevnet);
  const res = await fetch(`${base}/api/odds/snapshot/${fixtureId}`, {
    headers: await buildAuthHeaders(config),
  });
  if (!res.ok) {
    throw new Error(`Odds snapshot for ${fixtureId} failed: ${res.status}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function groupOddsSnapshot(data: unknown): Map<string, TxLineRawOdds[]> {
  const map = new Map<string, TxLineRawOdds[]>();
  const rows = Array.isArray(data) ? (data as TxLineRawOdds[]) : [];
  for (const row of rows) {
    const id = row.FixtureId != null ? String(row.FixtureId) : "";
    if (!id) continue;
    const existing = map.get(id) ?? [];
    existing.push(row);
    map.set(id, existing);
  }
  return map;
}

/** Fetch odds for many fixtures — prefers a single bulk snapshot over N requests. */
export async function fetchOddsForFixtures(
  config: TxLineClientConfig,
  fixtureIds: string[]
): Promise<Map<string, TxLineRawOdds[]>> {
  if (fixtureIds.length === 0) return new Map();

  try {
    const snapshot = await fetchOddsSnapshot(config);
    const grouped = groupOddsSnapshot(snapshot);
    return new Map(
      fixtureIds.map((id) => [id, grouped.get(id) ?? []] as const)
    );
  } catch {
    const entries = await Promise.all(
      fixtureIds.map(async (id) => {
        try {
          const odds = await fetchOddsForFixture(config, id);
          return [id, odds] as const;
        } catch {
          return [id, [] as TxLineRawOdds[]] as const;
        }
      })
    );
    return new Map(entries);
  }
}
