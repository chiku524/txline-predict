/** Semantic outcome ids from txline-client market builder. */
export type OutcomeTone = "home" | "draw" | "away" | "over" | "under" | "default";

const TONE_IDS: OutcomeTone[] = ["home", "draw", "away", "over", "under"];

export function getOutcomeTone(outcomeId: string): OutcomeTone {
  if (TONE_IDS.includes(outcomeId as OutcomeTone)) {
    return outcomeId as OutcomeTone;
  }
  return "default";
}

/** e.g. `outcomeToneClass("home")` → `outcome-option--home` */
export function outcomeToneClass(
  outcomeId: string,
  prefix = "outcome-option"
): string {
  return `${prefix}--${getOutcomeTone(outcomeId)}`;
}
