#!/usr/bin/env npx tsx
/**
 * Simulate a devnet bet tx and print simulation logs on failure.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { Connection } from "@solana/web3.js";
import idl from "../apps/web/src/lib/solana/idl/predict_market.json";
import {
  buildBetTransaction,
  sendBetTransaction,
} from "../apps/web/src/lib/solana/bet-transaction";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getUsdcMint } from "../apps/web/src/lib/solana/config";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(join(ROOT, "apps/web/.env.local"), "utf8");
const RPC =
  envText.match(/^NEXT_PUBLIC_RPC_URL=(.+)$/m)?.[1]?.trim() ??
  "https://api.devnet.solana.com";

const wallet = Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(readFileSync(join(ROOT, "platform/platform-wallet.json"), "utf8"))
  )
);

const FIXTURE_ID = process.argv[2] ?? "wc-2026-001";
const MARKET_TYPE = (process.argv[3] ?? "match_winner") as
  | "match_winner"
  | "total_goals"
  | "both_teams_score";
const KICKOFF = process.argv[4] ?? "2026-07-10T20:00:00Z";
const OUTCOME_COUNT = Number(process.argv[5] ?? "3");
const STAKE = 5_000_000;

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: import("@solana/web3.js").Transaction) => {
      tx.partialSign(wallet);
      return tx;
    },
    signAllTransactions: async (
      txs: import("@solana/web3.js").Transaction[]
    ) => {
      txs.forEach((tx) => tx.partialSign(wallet));
      return txs;
    },
  };

  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as Idl, provider);

  const usdcMint = getUsdcMint("devnet");
  const ata = getAssociatedTokenAddressSync(usdcMint, wallet.publicKey);
  const usdc = await connection.getTokenAccountBalance(ata).catch(() => null);
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("USDC balance:", usdc?.value.uiAmount ?? 0);
  console.log("Fixture:", FIXTURE_ID, MARKET_TYPE, "kickoff", KICKOFF);

  const tx = await buildBetTransaction({
    program,
    connection,
    wallet: wallet.publicKey,
    fixtureId: FIXTURE_ID,
    marketType: MARKET_TYPE,
    kickoffUtc: KICKOFF,
    outcomeCount: OUTCOME_COUNT,
    outcomeIndex: 0,
    stakeLamports: STAKE,
    network: "devnet",
  });

  console.log("Instructions:", tx.instructions.length);
  tx.instructions.forEach((ix, i) => {
    console.log(
      `  [${i}] program=${ix.programId.toBase58()} keys=${ix.keys.length}`
    );
  });

  try {
    const sig = await sendBetTransaction(connection, tx, anchorWallet);
    console.log("SUCCESS", sig);
  } catch (err) {
    console.error("FAILED:", err instanceof Error ? err.message : err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
