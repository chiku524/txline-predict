import type { Keypair } from "@solana/web3.js";
import {
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

/** Keypair → Anchor wallet adapter (server-side agents). */
export function keypairToAnchorWallet(keypair: Keypair): AnchorWallet {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      transaction: T
    ): Promise<T> => {
      if (transaction instanceof Transaction) {
        transaction.partialSign(keypair);
      }
      return transaction;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      transactions: T[]
    ): Promise<T[]> => {
      transactions.forEach((tx) => {
        if (tx instanceof Transaction) tx.partialSign(keypair);
      });
      return transactions;
    },
  };
}
