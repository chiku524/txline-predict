"use client";

import { AbstractLinesBackground } from "@/components/AbstractLinesBackground";
import { BetCelebrationProvider } from "@/components/BetCelebrationProvider";
import { SolanaProviders } from "@/components/SolanaProviders";
import { Header } from "@/components/Header";
import { TxLineStreamProvider } from "@/hooks/TxLineStreamProvider";

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <SolanaProviders>
      <TxLineStreamProvider>
        <BetCelebrationProvider>
          <div className="relative min-h-screen">
            <AbstractLinesBackground />
            <Header />
            <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
              {children}
            </main>
          </div>
        </BetCelebrationProvider>
      </TxLineStreamProvider>
    </SolanaProviders>
  );
}
