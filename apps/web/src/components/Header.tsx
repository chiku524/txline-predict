"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

const links = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/markets", label: "Markets" },
];

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  const networkLabel =
    process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
      ? "Mainnet"
      : "Devnet";

  return (
    <header className="header-bar sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(7,11,18,0.85)] backdrop-blur-md">
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

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition hover:text-white ${
                pathname === l.href ? "text-white" : "text-[var(--muted)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] sm:inline">
            {networkLabel}
          </span>
          <WalletMultiButton />
          <button
            type="button"
            className="header-menu-btn md:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="header-menu-btn__bar" />
            <span className="header-menu-btn__bar" />
            <span className="header-menu-btn__bar" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            className="header-menu-backdrop md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <nav
            id="mobile-nav"
            className="header-mobile-nav md:hidden"
            aria-label="Mobile"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`header-mobile-nav__link ${
                  pathname === l.href ? "header-mobile-nav__link--active" : ""
                }`}
                onClick={closeMenu}
              >
                {l.label}
              </Link>
            ))}
            <span className="header-mobile-nav__network">{networkLabel}</span>
          </nav>
        </>
      )}
    </header>
  );
}
