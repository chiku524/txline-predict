#!/usr/bin/env npx tsx
/** Deep simulation debug — prints full logs on failure. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import idl from "../apps/web/src/lib/solana/idl/predict_market.json";
import {
  buildBetTransaction,
  formatBetSimulationError,
  readSimulationResult,
} from "../apps/web/src/lib/solana/bet-transaction";
import { PREDICT_MARKET_PROGRAM_ID } from "../apps/web/src/lib/solana/config";

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

const FIXTURE_ID = process.argv[2] ?? "18175981";
const MARKET_TYPE = (process.argv[3] ?? "match_winner") as "match_winner";
const KICKOFF = process.argv[4] ?? "2026-06-30T21:00:00.000Z";

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const anchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(wallet);
      return tx;
    },
    signAllTransactions: async (txs: Transaction[]) => {
      txs.forEach((tx) => tx.partialSign(wallet));
      return txs;
    },
  };
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl as Idl, provider);

  const tx = await buildBetTransaction({
    program,
    connection,
    wallet: wallet.publicKey,
    fixtureId: FIXTURE_ID,
    marketType: MARKET_TYPE,
    kickoffUtc: KICKOFF,
    outcomeCount: 3,
    outcomeIndex: 0,
    stakeLamports: 1_000_000,
    network: "devnet",
  });

  tx.feePayer = wallet.publicKey;
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  console.log("=== Legacy simulate (Phantom-like) ===");
  const legacySim = await connection.simulateTransaction(tx);
  const legacy = readSimulationResult(legacySim);
  console.log("err:", JSON.stringify(legacy.err));
  console.log("msg:", formatBetSimulationError(legacy.err, legacy.logs));
  if (legacy.logs) legacy.logs.forEach((l) => console.log(" ", l));

  console.log("\n=== Versioned simulate ===");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: tx.instructions,
  }).compileToV0Message();
  const versionedSim = await connection.simulateTransaction(
    new VersionedTransaction(message),
    { sigVerify: false, commitment: "confirmed" }
  );
  const ver = readSimulationResult(versionedSim);
  console.log("err:", JSON.stringify(ver.err));
  console.log("msg:", formatBetSimulationError(ver.err, ver.logs));
}

main().catch(console.error);
