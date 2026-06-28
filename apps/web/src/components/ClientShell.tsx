"use client";

import { SolanaProviders } from "@/components/SolanaProviders";
import { Header } from "@/components/Header";
import { TxLineStreamProvider } from "@/hooks/TxLineStreamProvider";

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProviders>
      <TxLineStreamProvider>
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </TxLineStreamProvider>
    </SolanaProviders>
  );
}
