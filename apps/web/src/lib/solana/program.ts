import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import idl from "./idl/predict_market.json";
import { PREDICT_MARKET_PROGRAM_ID } from "./config";

export type PredictMarketProgram = Program<Idl>;

export function getPredictMarketProgram(
  connection: Connection,
  wallet: AnchorWallet
): PredictMarketProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export { PREDICT_MARKET_PROGRAM_ID };
