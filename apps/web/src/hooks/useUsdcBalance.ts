"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getUsdcMint } from "@/lib/solana/config";

export function useUsdcBalance() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const usdcMint = getUsdcMint(network);

  const refresh = useCallback(async () => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    setLoading(true);
    try {
      const ata = getAssociatedTokenAddressSync(usdcMint, publicKey);
      const info = await connection.getTokenAccountBalance(ata).catch(() => null);
      setBalance(info?.value.uiAmount ?? 0);
    } finally {
      setLoading(false);
    }
  }, [connection, publicKey, usdcMint]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return { balance, loading, refresh };
}
