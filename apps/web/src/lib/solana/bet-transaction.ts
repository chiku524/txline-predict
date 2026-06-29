import { BN, type Idl, type Program } from "@coral-xyz/anchor";
import type { MarketType } from "@txline-predict/txline-client";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionSignature,
} from "@solana/web3.js";
import {
  getMarketPda,
  getPositionPda,
  getUsdcMint,
  marketChainId,
} from "./config";
import { fetchOnChainMarket } from "./market";

/** Minimum SOL for fees + rent on first bet (market + vault + position + ATA). */
export const MIN_SOL_FOR_BET_LAMPORTS = 20_000_000;

async function estimateBetSolNeeded(
  connection: Connection,
  wallet: PublicKey,
  fixtureId: string,
  marketType: MarketType,
  network?: string
): Promise<number> {
  const usdcMint = getUsdcMint(network);
  const [marketPda] = getMarketPda(fixtureId, marketType);
  const depositorAta = getAssociatedTokenAddressSync(usdcMint, wallet);

  const [marketInfo, depositorAtaInfo] = await Promise.all([
    connection.getAccountInfo(marketPda).catch(() => null),
    connection.getAccountInfo(depositorAta).catch(() => null),
  ]);

  let lamports = 5_000_000; // tx fees + buffer

  if (!marketInfo) {
    const [marketRent, tokenRent, positionRent] = await Promise.all([
      connection.getMinimumBalanceForRentExemption(280),
      connection.getMinimumBalanceForRentExemption(165),
      connection.getMinimumBalanceForRentExemption(80),
    ]);
    lamports += marketRent + tokenRent * 2 + positionRent;
  } else if (!depositorAtaInfo) {
    lamports += await connection.getMinimumBalanceForRentExemption(165);
    const positionRent = await connection.getMinimumBalanceForRentExemption(80);
    lamports += positionRent;
  } else {
    lamports += await connection.getMinimumBalanceForRentExemption(80);
  }

  return lamports;
}

const RPC_RATE_LIMIT_MESSAGE =
  "Solana devnet RPC is rate-limited. Wait a few seconds and retry, or set NEXT_PUBLIC_RPC_URL to a dedicated devnet endpoint (Helius, QuickNode, etc.) in apps/web/.env.local.";

function rethrowRpcError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
    throw new Error(RPC_RATE_LIMIT_MESSAGE);
  }
  throw err instanceof Error ? err : new Error(msg);
}

const PREDICT_ERROR_OFFSET = 6000;

/** Rpc simulateTransaction returns `{ value: { err, logs } }` in web3.js 1.x. */
export function readSimulationResult(simulation: {
  err?: unknown;
  logs?: string[] | null;
  value?: { err?: unknown; logs?: string[] | null };
}): { err: unknown; logs: string[] | null | undefined } {
  if (simulation.value) {
    return { err: simulation.value.err, logs: simulation.value.logs };
  }
  return { err: simulation.err, logs: simulation.logs };
}

function lastProgramLog(logs?: string[] | null): string | null {
  if (!logs?.length) return null;
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i]?.trim();
    if (line && !line.startsWith("Program log: Instruction:")) {
      return line.replace(/^Program log: /, "");
    }
  }
  return null;
}

const PREDICT_ERROR_MESSAGES: Record<number, string> = {
  0: "This market is closed or already settled.",
  1: "Betting is locked — kickoff has already passed for this market.",
  2: "This market has not settled yet.",
  3: "Invalid outcome selected.",
  4: "Invalid market configuration.",
  5: "Enter a valid stake amount.",
  6: "Market identifier is too long.",
  7: "Market vault mismatch — contact support.",
  8: "Amount overflow.",
  9: "Unauthorized.",
  10: "Winning outcome does not match verified scores.",
  11: "Winnings already claimed.",
  12: "Only winning positions can claim.",
  13: "Winning pool is empty.",
  14: "Unknown market type.",
  15: "Invalid TxLINE oracle program.",
};

export function formatBetSimulationError(
  err: unknown,
  logs?: string[] | null
): string {
  if (err && typeof err === "object" && "InstructionError" in err) {
    const ixErr = (err as { InstructionError: [number, unknown] })
      .InstructionError[1];
    if (
      ixErr &&
      typeof ixErr === "object" &&
      "Custom" in ixErr &&
      typeof (ixErr as { Custom: number }).Custom === "number"
    ) {
      const code = (ixErr as { Custom: number }).Custom - PREDICT_ERROR_OFFSET;
      if (PREDICT_ERROR_MESSAGES[code]) {
        return PREDICT_ERROR_MESSAGES[code];
      }
    }
  }

  const logText = (logs ?? []).join("\n");

  const anchorCodeMatch = logText.match(/Error Number: (\d+)/);
  if (anchorCodeMatch) {
    const code = Number(anchorCodeMatch[1]) - PREDICT_ERROR_OFFSET;
    if (PREDICT_ERROR_MESSAGES[code]) {
      return PREDICT_ERROR_MESSAGES[code];
    }
  }

  const anchorNameMatch = logText.match(/Error Code: (\w+)/);
  if (anchorNameMatch) {
    const nameToCode: Record<string, number> = {
      MarketClosed: 0,
      MarketLocked: 1,
      MarketNotResolved: 2,
      InvalidOutcome: 3,
      InvalidOutcomes: 4,
      InvalidAmount: 5,
      FixtureIdTooLong: 6,
      InvalidVault: 7,
      Overflow: 8,
      UnauthorizedKeeper: 9,
      WinningOutcomeMismatch: 10,
      AlreadyClaimed: 11,
      NotWinner: 12,
      EmptyWinningPool: 13,
      UnknownMarketType: 14,
      InvalidTxLineProgram: 15,
    };
    const code = nameToCode[anchorNameMatch[1]];
    if (code != null && PREDICT_ERROR_MESSAGES[code]) {
      return PREDICT_ERROR_MESSAGES[code];
    }
  }

  if (
    logText.includes("insufficient funds") ||
    logText.includes("InsufficientFunds")
  ) {
    return "Insufficient USDC in your wallet for this stake.";
  }
  if (
    logText.includes("insufficient lamports") ||
    logText.includes("InsufficientFundsForRent")
  ) {
    return "Not enough devnet SOL for account rent and fees. Fund ~0.02 SOL from https://faucet.solana.com then retry.";
  }
  if (
    logText.includes("already in use") ||
    logText.includes("AccountAlreadyInitialized")
  ) {
    return "Market vault already exists — refresh the page and retry your bet.";
  }
  if (
    logText.includes("ConstraintSeeds") ||
    logText.includes("seeds constraint")
  ) {
    return "On-chain account mismatch — refresh the page and retry. If this persists, contact support.";
  }
  if (
    logText.includes("Attempt to debit an account but found no record") ||
    logText.includes("AccountNotFound")
  ) {
    return "Missing devnet SOL for transaction fees and account rent. Fund your wallet with SOL from https://faucet.solana.com (devnet), then retry.";
  }

  const hint = lastProgramLog(logs);
  if (hint) {
    return `Transaction simulation failed: ${hint}`;
  }

  if (logs?.length) {
    console.warn("[bet simulation logs]", logs);
  }

  return "Transaction simulation failed. Ensure your wallet is on devnet with enough SOL (~0.02) and USDC.";
}

export async function assertBetPreflight(
  connection: Connection,
  fixtureId: string,
  marketType: MarketType,
  kickoffUtc: string,
  stakeLamports: number,
  wallet: PublicKey,
  network?: string
): Promise<void> {
  if (stakeLamports <= 0) {
    throw new Error("Enter a valid stake amount.");
  }

  const solNeeded = await estimateBetSolNeeded(
    connection,
    wallet,
    fixtureId,
    marketType,
    network
  ).catch(rethrowRpcError);
  const solBalance = await connection.getBalance(wallet).catch(rethrowRpcError);
  if (solBalance < solNeeded) {
    throw new Error(
      `Need at least ${(solNeeded / 1e9).toFixed(3)} SOL on devnet for fees and account rent (you have ${(solBalance / 1e9).toFixed(3)}). Get SOL from https://faucet.solana.com`
    );
  }

  const usdcMint = getUsdcMint(network);
  const depositorAta = getAssociatedTokenAddressSync(usdcMint, wallet);
  const tokenBalance = await connection
    .getTokenAccountBalance(depositorAta)
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        throw new Error(RPC_RATE_LIMIT_MESSAGE);
      }
      return null;
    });
  const usdcLamports = tokenBalance
    ? Number(tokenBalance.value.amount)
    : 0;
  if (usdcLamports < stakeLamports) {
    throw new Error(
      `Insufficient USDC (need ${(stakeLamports / 1e6).toFixed(2)} USDC on mint ${usdcMint.toBase58()}). Fund devnet USDC from https://faucet.circle.com — select Solana Devnet.`
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const kickoffSec = Math.floor(new Date(kickoffUtc).getTime() / 1000);
  if (nowSec >= kickoffSec) {
    throw new Error(
      "Betting is locked — this match has already kicked off."
    );
  }

  const onChain = await fetchOnChainMarket(connection, fixtureId, marketType);
  if (
    onChain.exists &&
    onChain.lockTimestamp != null &&
    nowSec >= onChain.lockTimestamp
  ) {
    throw new Error(
      "Betting is locked on-chain — kickoff has passed for this market vault."
    );
  }
  if (onChain.exists && onChain.status !== "open") {
    throw new Error(
      onChain.status === "resolved"
        ? "This market is already settled."
        : "This market is not open for betting."
    );
  }
}

interface BuildBetTxParams {
  program: Program<Idl>;
  connection: Connection;
  wallet: PublicKey;
  fixtureId: string;
  marketType: MarketType;
  kickoffUtc: string;
  outcomeCount: number;
  outcomeIndex: number;
  stakeLamports: number;
  network?: string;
}

/** Single transaction: create market (if needed), idempotent ATA, deposit. */
export async function buildBetTransaction({
  program,
  connection,
  wallet,
  fixtureId,
  marketType,
  kickoffUtc,
  outcomeCount,
  outcomeIndex,
  stakeLamports,
  network,
}: BuildBetTxParams): Promise<Transaction> {
  const usdcMint = getUsdcMint(network);
  const chainId = marketChainId(fixtureId, marketType);
  const [marketPda] = getMarketPda(fixtureId, marketType);
  const vault = getAssociatedTokenAddressSync(usdcMint, marketPda, true);
  const depositorAta = getAssociatedTokenAddressSync(usdcMint, wallet);
  const [positionPda] = getPositionPda(marketPda, wallet, outcomeIndex);

  const tx = new Transaction();

  let marketAccount;
  try {
    marketAccount = await connection.getAccountInfo(marketPda);
  } catch (err) {
    rethrowRpcError(err);
  }
  if (!marketAccount) {
    const lockTs = Math.floor(new Date(kickoffUtc).getTime() / 1000);
    const createIx = await program.methods
      .createMarket(chainId, outcomeCount, new BN(lockTs))
      .accounts({
        authority: wallet,
        market: marketPda,
        usdcMint,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    tx.add(createIx);
  }

  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      wallet,
      depositorAta,
      wallet,
      usdcMint
    )
  );

  const depositIx = await program.methods
    .deposit(outcomeIndex, new BN(stakeLamports))
    .accounts({
      depositor: wallet,
      market: marketPda,
      position: positionPda,
      depositorTokenAccount: depositorAta,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  tx.add(depositIx);

  return tx;
}

export async function sendBetTransaction(
  connection: Connection,
  tx: Transaction,
  wallet: {
    publicKey: PublicKey;
    signTransaction: (tx: Transaction) => Promise<Transaction>;
  }
): Promise<TransactionSignature> {
  tx.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  // Simulate the legacy tx Phantom will sign (not VersionedTransaction).
  const simulation = await connection.simulateTransaction(tx);
  const { err, logs } = readSimulationResult(simulation);
  if (err) {
    if (logs?.length) {
      console.warn("[bet simulation logs]", logs);
    }
    throw new Error(formatBetSimulationError(err, logs));
  }

  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: true,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}
