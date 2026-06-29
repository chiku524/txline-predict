export const siteConfig = {
  name: "TxLINE Predict",
  tagline: "Verifiable World Cup Prediction Markets",
  description:
    "Permissionless prediction markets on Solana, powered by TxLINE real-time World Cup data and cryptographic settlement proofs.",
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000",
  locale: "en_US",
  keywords: [
    "prediction markets",
    "World Cup",
    "Solana",
    "TxLINE",
    "sports betting",
    "crypto",
    "verifiable settlement",
    "World Cup 2026",
  ],
} as const;

export function pageTitle(title?: string): string {
  if (!title) {
    return `${siteConfig.name} — ${siteConfig.tagline}`;
  }
  return `${title} | ${siteConfig.name}`;
}
