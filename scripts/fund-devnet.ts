#!/usr/bin/env npx tsx
/**
 * Fund platform wallet on devnet with SOL and USDC.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WALLET_PATH = join(ROOT, "platform/platform-wallet.json");
const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
/** Circle devnet USDC mint (community faucet). */
const DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

async function requestSol(connection: Connection, pubkey: Keypair["publicKey"]) {
  for (let i = 0; i < 3; i++) {
    try {
      const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      const bal = await connection.getBalance(pubkey);
      console.log(`SOL balance: ${bal / LAMPORTS_PER_SOL}`);
      if (bal >= 0.5 * LAMPORTS_PER_SOL) return bal;
    } catch (e) {
      console.log(`Airdrop attempt ${i + 1} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const bal = await connection.getBalance(pubkey);
  if (bal >= 0.5 * LAMPORTS_PER_SOL) {
    console.log(`SOL balance (existing): ${bal / LAMPORTS_PER_SOL}`);
    return bal;
  }
  console.log(
    "\nDevnet airdrop rate-limited. Fund manually:\n" +
      "  SOL:  https://faucet.solana.com/\n" +
      "  USDC: https://faucet.circle.com/ (Solana Devnet)\n" +
      `  Wallet: ${pubkey.toBase58()}\n`
  );
  return bal;
}

async function requestCircleUsdc(address: string) {
  const res = await fetch("https://faucet.circle.com/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "RequestUsdc",
      variables: { input: { blockchain: "SOLANA", address } },
      query: `mutation RequestUsdc($input: RequestUsdcInput!) {
        requestUsdc(input: $input) { amount blockchain address }
      }`,
    }),
  });
  const text = await res.text();
  console.log("Circle faucet:", res.status, text.slice(0, 200));
  return res.ok;
}

async function main() {
  const secret = JSON.parse(readFileSync(WALLET_PATH, "utf8")) as number[];
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
  const connection = new Connection(DEVNET_RPC, "confirmed");

  console.log("Platform wallet:", keypair.publicKey.toBase58());
  console.log("Cluster: devnet\n");

  const solBal = await requestSol(connection, keypair.publicKey);
  console.log("\nRequesting devnet USDC from Circle faucet…");
  try {
    await requestCircleUsdc(keypair.publicKey.toBase58());
  } catch (e) {
    console.log("Circle faucet error:", (e as Error).message);
  }

  // Check USDC balance
  const usdcMint = new PublicKey(DEVNET_USDC);
  const ata = getAssociatedTokenAddressSync(usdcMint, keypair.publicKey);
  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  if (info) {
    console.log("USDC balance:", info.value.uiAmountString);
  } else {
    console.log("USDC ATA not found yet — Circle faucet may take a minute.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
