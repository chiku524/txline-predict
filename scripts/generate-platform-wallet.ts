#!/usr/bin/env npx tsx
/**
 * Generate (or load) the dedicated platform Solana wallet.
 * Keypair is stored at platform/platform-wallet.json (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PLATFORM_DIR = join(ROOT, "platform");
export const WALLET_PATH = join(PLATFORM_DIR, "platform-wallet.json");

export function loadOrCreatePlatformWallet(): Keypair {
  mkdirSync(PLATFORM_DIR, { recursive: true });

  if (existsSync(WALLET_PATH)) {
    const secret = JSON.parse(readFileSync(WALLET_PATH, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }

  const keypair = Keypair.generate();
  writeFileSync(WALLET_PATH, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

if (process.argv[1]?.includes("generate-platform-wallet")) {
  const kp = loadOrCreatePlatformWallet();
  console.log("Platform wallet public key:", kp.publicKey.toBase58());
  console.log("Saved to:", WALLET_PATH);
}
