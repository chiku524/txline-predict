#!/usr/bin/env npx tsx
/**
 * Fund momentum + contrarian agent wallets on devnet.
 * Transfers SOL + USDC from platform/platform-wallet.json.
 *
 * Usage (from repo root):
 *   npm run devnet:fund          # fund platform wallet first
 *   npm run devnet:fund-agents   # then fund both agents
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM = join(ROOT, "platform");
const DEVNET_USDC = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

const AGENT_FILES = {
  momentum: "agent-momentum.json",
  contrarian: "agent-contrarian.json",
} as const;

const SOL_TOP_UP = 0.05;
const USDC_TOP_UP = 5_000_000; // 5 USDC
const MIN_USDC = 2_000_000; // top up if below 2 USDC

function loadEnvRpc(): string {
  const envPath = join(ROOT, "apps/web/.env.local");
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, "utf8").match(/^NEXT_PUBLIC_RPC_URL=(.+)$/m);
    if (match) return match[1].trim();
  }
  return process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
}

function loadOrCreateKeypair(filename: string): Keypair {
  if (!existsSync(PLATFORM)) mkdirSync(PLATFORM, { recursive: true });
  const path = join(PLATFORM, filename);
  if (!existsSync(path)) {
    const kp = Keypair.generate();
    writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
    console.log(`Created ${filename} → ${kp.publicKey.toBase58()}`);
    return kp;
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8")))
  );
}

function loadKeypair(filename: string): Keypair {
  const path = join(PLATFORM, filename);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path} — run: npm run devnet:fund-agents (auto-creates)`);
  }
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(path, "utf8")))
  );
}

async function main() {
  const rpc = loadEnvRpc();
  const conn = new Connection(rpc, "confirmed");
  const funder = loadKeypair("platform-wallet.json");
  const funderAta = getAssociatedTokenAddressSync(DEVNET_USDC, funder.publicKey);

  console.log("RPC:", rpc.replace(/api-key=.+/i, "api-key=***"));
  console.log("Funder (platform wallet):", funder.publicKey.toBase58());
  console.log(
    "Funder SOL:",
    (await conn.getBalance(funder.publicKey)) / LAMPORTS_PER_SOL
  );
  const funderUsdc = await conn
    .getTokenAccountBalance(funderAta)
    .catch(() => null);
  console.log("Funder USDC:", funderUsdc?.value.uiAmount ?? 0);
  console.log(
    "\nIf funder is empty, run: npm run devnet:fund\n" +
      "Or fund platform-wallet manually via https://faucet.solana.com + https://faucet.circle.com\n"
  );

  for (const [label, file] of Object.entries(AGENT_FILES)) {
    const agent = loadOrCreateKeypair(file);
    console.log(`\n── ${label} agent (${file}) ──`);
    console.log("Address:", agent.publicKey.toBase58());
    console.log(
      "Explorer:",
      `https://explorer.solana.com/address/${agent.publicKey.toBase58()}?cluster=devnet`
    );

    const bal = await conn.getBalance(agent.publicKey);
    if (bal < 0.03 * LAMPORTS_PER_SOL) {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: funder.publicKey,
          toPubkey: agent.publicKey,
          lamports: Math.floor(SOL_TOP_UP * LAMPORTS_PER_SOL),
        })
      );
      tx.feePayer = funder.publicKey;
      tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
      tx.sign(funder);
      await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()));
      console.log(`  ✓ Sent ${SOL_TOP_UP} SOL from platform wallet`);
    } else {
      console.log("  SOL OK:", (bal / LAMPORTS_PER_SOL).toFixed(4));
    }

    const agentAta = getAssociatedTokenAddressSync(DEVNET_USDC, agent.publicKey);
    const tb = await conn.getTokenAccountBalance(agentAta).catch(() => null);
    const usdcLamports = tb ? Number(tb.value.amount) : 0;

    if (usdcLamports < MIN_USDC) {
      try {
        const tx = new Transaction().add(
          createAssociatedTokenAccountIdempotentInstruction(
            funder.publicKey,
            agentAta,
            agent.publicKey,
            DEVNET_USDC
          ),
          createTransferInstruction(
            funderAta,
            agentAta,
            funder.publicKey,
            USDC_TOP_UP
          )
        );
        tx.feePayer = funder.publicKey;
        tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
        tx.sign(funder);
        await conn.confirmTransaction(await conn.sendRawTransaction(tx.serialize()));
        console.log(`  ✓ Sent ${USDC_TOP_UP / 1e6} USDC from platform wallet`);
      } catch (err) {
        console.log(
          `  ✗ USDC transfer failed (platform wallet needs devnet USDC).`
        );
        console.log(
          `    Manual: send USDC to ${agent.publicKey.toBase58()} via https://faucet.circle.com`
        );
      }
    } else {
      console.log("  USDC OK:", tb?.value.uiAmount ?? 0);
    }
  }

  console.log("\nDone. Agent keys live in platform/ (gitignored).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
