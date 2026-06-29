"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

/** Defer wallet UI until after mount to avoid SSR/client hydration mismatch. */
export function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="wallet-adapter-button wallet-adapter-button-trigger"
        disabled
      >
        Select Wallet
      </button>
    );
  }

  return <WalletMultiButton />;
}
