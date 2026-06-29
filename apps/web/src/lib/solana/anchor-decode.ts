/** Anchor IDL account fields may decode as snake_case or camelCase. */
export function anchorField<T>(
  record: Record<string, unknown>,
  ...keys: string[]
): T | undefined {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) {
      return value as T;
    }
  }
  return undefined;
}

export function anchorNumber(
  value: unknown
): number {
  if (value == null) return 0;
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Fallback outcome label when off-chain market metadata is unavailable. */
export function defaultOutcomeLabel(
  marketType: string,
  outcomeIndex: number
): string {
  if (marketType === "match_winner") {
    return ["Home", "Draw", "Away"][outcomeIndex] ?? `Side ${outcomeIndex + 1}`;
  }
  if (marketType === "total_goals") {
    return ["Over 2.5", "Under 2.5"][outcomeIndex] ?? `Side ${outcomeIndex + 1}`;
  }
  if (marketType === "both_teams_score") {
    return ["Yes", "No"][outcomeIndex] ?? `Side ${outcomeIndex + 1}`;
  }
  return `Outcome ${outcomeIndex + 1}`;
}
