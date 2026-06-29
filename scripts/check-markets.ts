#!/usr/bin/env npx tsx
import { readFileSync } from "node:fs";
import { BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import {
  buildMarketsFromFixtures,
  fetchFixturesSnapshot,
  fetchOddsForFixtures,
  mapRawFixtures,
} from "@txline-predict/txline-client";
import idl from "../apps/web/src/lib/solana/idl/predict_market.json";
import { getMarketPda } from "../apps/web/src/lib/solana/config";
import { fetchOnChainMarket } from "../apps/web/src/lib/solana/market";

const env = readFileSync("apps/web/.env.local", "utf8");
const token = env.match(/^TXLINE_API_TOKEN=(.+)$/m)?.[1]?.trim();
const rpc =
  env.match(/^NEXT_PUBLIC_RPC_URL=(.+)$/m)?.[1]?.trim() ??
  "https://api.devnet.solana.com";

function decodeStatus(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "unknown";
  const key = Object.keys(raw)[0];
  return key ?? "unknown";
}

async function main() {
  const conn = new Connection(rpc, "confirmed");
  const coder = new BorshAccountsCoder(idl as Idl);

  const raw = await fetchFixturesSnapshot({ apiToken: token! });
  const fixtures = mapRawFixtures(raw);
  const odds = await fetchOddsForFixtures(
    { apiToken: token! },
    fixtures.map((f) => f.fixtureId)
  );
  const markets = buildMarketsFromFixtures(fixtures, odds);
  const open = markets.filter((m) => m.status === "open");

  console.log(`Total markets: ${markets.length}, open UI: ${open.length}\n`);

  for (const m of open) {
    const [pda] = getMarketPda(m.fixtureId, m.type);
    const info = await conn.getAccountInfo(pda);
    const chain = await fetchOnChainMarket(conn, m.fixtureId, m.type);
    let rawStatus = "n/a";
    if (info) {
      const acc = coder.decode("Market", info.data) as { status: unknown };
      rawStatus = JSON.stringify(acc.status);
    }
    console.log({
      fixtureId: m.fixtureId,
      type: m.type,
      kickoff: m.kickoffUtc,
      uiStatus: m.status,
      chainExists: chain.exists,
      chainStatus: chain.status,
      lockTimestamp: chain.lockTimestamp,
      rawStatus,
      pda: pda.toBase58(),
    });
  }
}

main().catch(console.error);
