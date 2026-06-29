/** On-chain MarketStatus from Anchor (PascalCase variant keys). */
export type ChainMarketStatus =
  | "open"
  | "locked"
  | "resolved"
  | "cancelled"
  | "unknown";

export function decodeMarketStatus(raw: unknown): ChainMarketStatus {
  if (!raw || typeof raw !== "object") return "unknown";
  const key = Object.keys(raw)[0];
  if (!key) return "unknown";
  const normalized = key.toLowerCase();
  if (normalized === "open") return "open";
  if (normalized === "locked") return "locked";
  if (normalized === "resolved") return "resolved";
  if (normalized === "cancelled") return "cancelled";
  return "unknown";
}
