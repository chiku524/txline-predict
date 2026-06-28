import type { MarketType } from "@txline-predict/txline-client";
import { PublicKey } from "@solana/web3.js";

export const PREDICT_MARKET_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PREDICT_MARKET_PROGRAM_ID ??
    "47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3"
);

/** Circle devnet USDC — swap on Jupiter or use faucet for testing. */
export const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

export const MAINNET_USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export function getUsdcMint(network?: string): PublicKey {
  const override = process.env.NEXT_PUBLIC_USDC_MINT;
  if (override) return new PublicKey(override);
  return network === "mainnet-beta" ? MAINNET_USDC_MINT : DEVNET_USDC_MINT;
}

export const USDC_DECIMALS = 6;

export function parseUsdcAmount(input: string): number {
  const trimmed = input.trim();
  if (!trimmed || Number.isNaN(Number(trimmed))) return 0;
  const [whole, frac = ""] = trimmed.split(".");
  const padded = (frac + "000000").slice(0, USDC_DECIMALS);
  return Number(whole) * 1_000_000 + Number(padded);
}

export function getPositionPda(
  marketPda: PublicKey,
  depositor: PublicKey,
  outcomeIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      marketPda.toBuffer(),
      depositor.toBuffer(),
      Buffer.from([outcomeIndex]),
    ],
    PREDICT_MARKET_PROGRAM_ID
  );
}

export function getTxLineProgramId(network?: string): PublicKey {
  const useDevnet = network !== "mainnet-beta";
  return new PublicKey(
    useDevnet
      ? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
      : "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"
  );
}

export function getDailyScoresMerkleRootsPda(
  network?: string,
  epochDay = Math.floor(Date.now() / (24 * 60 * 60 * 1000))
): [PublicKey, number] {
  const programId = getTxLineProgramId(network);
  const dayBuf = Buffer.alloc(2);
  dayBuf.writeUInt16LE(epochDay, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), dayBuf],
    programId
  );
}
export function marketChainId(fixtureId: string, marketType: MarketType): string {
  return `${fixtureId}:${marketType}`;
}

export function getMarketPda(
  fixtureId: string,
  marketType: MarketType
): [PublicKey, number] {
  const chainId = marketChainId(fixtureId, marketType);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(chainId)],
    PREDICT_MARKET_PROGRAM_ID
  );
}
