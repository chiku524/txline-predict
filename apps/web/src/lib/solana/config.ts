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

export function getMarketPda(fixtureId: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(fixtureId)],
    PREDICT_MARKET_PROGRAM_ID
  );
}
