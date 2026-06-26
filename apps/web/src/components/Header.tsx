"use client";

import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const links = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/markets", label: "Markets" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(7,11,18,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-sm font-black text-[#04120e]">
            TP
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">TxLINE Predict</div>
            <div className="text-xs text-[var(--muted)]">Verifiable World Cup markets</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-[var(--muted)] transition hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:inline">
            {process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
              ? "Mainnet"
              : "Devnet"}
          </span>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
