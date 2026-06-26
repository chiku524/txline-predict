#!/usr/bin/env npx tsx
/**
 * Subscribe to TxLINE World Cup free tier on mainnet and activate API access.
 * @see https://txline.txodds.com/documentation/worldcup
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import idl from "./idl/txoracle.json";
import { loadOrCreatePlatformWallet, PLATFORM_DIR } from "./generate-platform-wallet";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const USE_DEVNET = process.env.TXLINE_USE_DEVNET === "true";
const MAINNET_RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const DEVNET_RPC = process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
const TXLINE_API = USE_DEVNET
  ? "https://txline-dev.txodds.com"
  : "https://txline.txodds.com";
const RPC = USE_DEVNET ? DEVNET_RPC : MAINNET_RPC;

/** 12 = World Cup real-time (free). Use 1 for 60-second delay. */
const SERVICE_LEVEL_ID = Number(process.env.TXLINE_SERVICE_LEVEL ?? "12");
const DURATION_WEEKS = Number(process.env.TXLINE_DURATION_WEEKS ?? "4");
const SELECTED_LEAGUES: number[] = [];
const MIN_SOL_LAMPORTS = 5_000_000; // ~0.005 SOL for fees + ATA rent

async function main() {
  const keypair = loadOrCreatePlatformWallet();
  const pubkey = keypair.publicKey.toBase58();

  console.log("=== TxLINE Platform Setup ===\n");
  console.log("Network:", USE_DEVNET ? "devnet" : "mainnet");
  console.log("Platform wallet:", pubkey);

  const connection = new Connection(RPC, "confirmed");
  let balance = await connection.getBalance(keypair.publicKey);
  console.log("SOL balance:", balance / 1e9, "SOL");

  if (balance < MIN_SOL_LAMPORTS) {
    if (USE_DEVNET) {
      console.log("\nRequesting devnet airdrop (2 SOL)...");
      const sig = await connection.requestAirdrop(keypair.publicKey, 2e9);
      await connection.confirmTransaction(sig, "confirmed");
      balance = await connection.getBalance(keypair.publicKey);
      console.log("SOL balance after airdrop:", balance / 1e9, "SOL");
    } else {
      console.log("\n⚠️  Insufficient SOL for mainnet subscription.");
      console.log("Send at least 0.01 SOL to the platform wallet, then re-run:");
      console.log(`  npm run txline:setup\n`);
      console.log("Address:", pubkey);
      process.exit(1);
    }
  }

  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const programId = new PublicKey(
    USE_DEVNET
      ? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
      : (idl as { address: string }).address
  );
  const program = new Program(
    { ...(idl as object), address: programId.toBase58() } as anchor.Idl,
    provider
  );
  const subscriptionTokenMint = new PublicKey(
    USE_DEVNET
      ? "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"
      : (idl as { constants: { name: string; value: string }[] }).constants.find(
          (c) => c.name === "TXLINE_MINT"
        )!.value
  );

  console.log("\nCreating TxL token account (if needed)...");
  const userTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    subscriptionTokenMint,
    keypair.publicKey,
    false,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    program.programId
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    program.programId
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    subscriptionTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("\nAuthenticating guest session...");
  const authResponse = await axios.post(`${TXLINE_API}/auth/guest/start`);
  const jwt: string = authResponse.data.token;

  console.log(
    `Subscribing on-chain (service level ${SERVICE_LEVEL_ID}, ${DURATION_WEEKS} weeks)...`
  );

  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: subscriptionTokenMint,
      userTokenAccount: userTokenAccount.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  console.log("Subscription tx:", txSig);
  const cluster = USE_DEVNET ? "?cluster=devnet" : "";
  console.log(`Explorer: https://explorer.solana.com/tx/${txSig}${cluster}`);

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const message = new TextEncoder().encode(messageString);
  const signatureBytes = nacl.sign.detached(message, keypair.secretKey);
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  console.log("\nActivating API token...");
  const activationResponse = await axios.post(
    `${TXLINE_API}/api/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );

  const apiToken: string =
    activationResponse.data.token ?? activationResponse.data;

  mkdirSync(PLATFORM_DIR, { recursive: true });
  const credentials = {
    walletPublicKey: pubkey,
    subscriptionTx: txSig,
    serviceLevelId: SERVICE_LEVEL_ID,
    durationWeeks: DURATION_WEEKS,
    activatedAt: new Date().toISOString(),
    apiToken,
  };
  writeFileSync(
    join(PLATFORM_DIR, "credentials.json"),
    JSON.stringify(credentials, null, 2)
  );

  const envPath = join(ROOT, "apps/web/.env.local");
  writeFileSync(
    envPath,
    [
      `TXLINE_API_TOKEN=${apiToken}`,
      `NEXT_PUBLIC_USE_DEMO_DATA=false`,
      `NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta`,
      `PLATFORM_WALLET_PUBKEY=${pubkey}`,
    ].join("\n") + "\n"
  );

  console.log("\n✅ TxLINE API access activated!");
  console.log("Credentials saved to: platform/credentials.json");
  console.log("Web app env written to: apps/web/.env.local");
  console.log("\nAPI token (first 20 chars):", apiToken.slice(0, 20) + "…");
}

main().catch((err) => {
  if (axios.isAxiosError(err)) {
    console.error("API error:", err.response?.status, err.response?.data ?? err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
