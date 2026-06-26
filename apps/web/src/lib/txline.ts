import type { TxLineFixture } from "@txline-predict/txline-client";
import {
  fetchFixturesSnapshot,
  fetchScoresSnapshot,
  mapRawFixtures,
  mergeScoresIntoFixtures,
} from "@txline-predict/txline-client";
import { DEMO_FIXTURES } from "./demo-data";

const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true";
const apiToken = process.env.TXLINE_API_TOKEN ?? "";

export async function getFixtures(): Promise<TxLineFixture[]> {
  if (useDemo || !apiToken) return DEMO_FIXTURES;
  try {
    const [fixturesRaw, scoresRaw] = await Promise.all([
      fetchFixturesSnapshot({ apiToken }),
      fetchScoresSnapshot({ apiToken }).catch(() => []),
    ]);
    const mapped = mapRawFixtures(fixturesRaw);
    const merged = mergeScoresIntoFixtures(
      mapped.length > 0 ? mapped : DEMO_FIXTURES,
      scoresRaw
    );
    return merged;
  } catch {
    return DEMO_FIXTURES;
  }
}

export function isDemoMode(): boolean {
  return useDemo || !apiToken;
}
