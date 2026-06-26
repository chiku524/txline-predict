/** Format implied probability as decimal odds (e.g. 0.41 → 2.44). */
export function decimalOdds(impliedProbability?: number): number | null {
  if (impliedProbability == null || impliedProbability <= 0) return null;
  return 1 / impliedProbability;
}

export function formatOdds(impliedProbability?: number): string {
  const odds = decimalOdds(impliedProbability);
  if (odds == null) return "—";
  return odds >= 10 ? odds.toFixed(1) : odds.toFixed(2);
}

/** Fair-odds estimate of gross return on a winning bet (not parimutuel). */
export function estimateReturn(
  stakeUsdc: number,
  impliedProbability?: number
): number | null {
  const odds = decimalOdds(impliedProbability);
  if (odds == null || stakeUsdc <= 0) return null;
  return stakeUsdc * odds;
}

export function formatUsdc(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const QUICK_STAKES = [1, 5, 10, 25] as const;

export function explorerTxUrl(signature: string, network: string): string {
  const cluster = network === "mainnet-beta" ? "" : `?cluster=${network}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}
