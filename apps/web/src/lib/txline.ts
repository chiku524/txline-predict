import type { TxLineFixture } from "@txline-predict/txline-client";
import { fetchFixturesSnapshot, mapRawFixtures } from "@txline-predict/txline-client";
import { DEMO_FIXTURES } from "./demo-data";

const useDemo = process.env.NEXT_PUBLIC_USE_DEMO_DATA === "true";
const apiToken = process.env.TXLINE_API_TOKEN ?? "";

export async function getFixtures(): Promise<TxLineFixture[]> {
  if (useDemo || !apiToken) return DEMO_FIXTURES;
  try {
    const raw = await fetchFixturesSnapshot({ apiToken });
    const mapped = mapRawFixtures(raw);
    return mapped.length > 0 ? mapped : DEMO_FIXTURES;
  } catch {
    return DEMO_FIXTURES;
  }
}

export function isDemoMode(): boolean {
  return useDemo || !apiToken;
}
