import { getOracleBaseUrl, type TxLineClientConfig } from "./config";

export interface StreamEndpoints {
  oddsSnapshot: string;
  oddsStream: string;
  scoresSnapshot: string;
  scoresStream: string;
  fixturesSnapshot: string;
}

/** TxLINE SSE / snapshot endpoints used by this project. */
export function getStreamEndpoints(config: TxLineClientConfig): StreamEndpoints {
  const base = getOracleBaseUrl(config.useDevnet);
  return {
    oddsSnapshot: `${base}/guest/odds/snapshot`,
    oddsStream: `${base}/guest/odds/stream`,
    scoresSnapshot: `${base}/guest/scores/snapshot`,
    scoresStream: `${base}/guest/scores/stream`,
    fixturesSnapshot: `${base}/guest/fixtures/snapshot`,
  };
}

export function authHeaders(apiToken: string): HeadersInit {
  return { Authorization: `Bearer ${apiToken}` };
}

/** Fetch latest odds snapshot for World Cup fixtures. */
export async function fetchOddsSnapshot(
  config: TxLineClientConfig
): Promise<unknown> {
  const { oddsSnapshot } = getStreamEndpoints(config);
  const res = await fetch(oddsSnapshot, { headers: authHeaders(config.apiToken) });
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
  const res = await fetch(scoresSnapshot, { headers: authHeaders(config.apiToken) });
  if (!res.ok) {
    throw new Error(`Scores snapshot failed: ${res.status}`);
  }
  return res.json();
}
