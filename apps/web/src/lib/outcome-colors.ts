/** Semantic outcome ids from txline-client market builder. */
export type OutcomeTone =
  | "home"
  | "draw"
  | "away"
  | "over"
  | "under"
  | "yes"
  | "no"
  | "default";

const TONE_IDS: OutcomeTone[] = [
  "home",
  "draw",
  "away",
  "over",
  "under",
  "yes",
  "no",
];

export interface OutcomeLegendItem {
  tone: OutcomeTone;
  label: string;
  meaning: string;
}

/** UI legend — colors identify role/side, not win or loss. */
export const OUTCOME_LEGEND: OutcomeLegendItem[] = [
  {
    tone: "home",
    label: "Green",
    meaning: "Home team (1X2) or first listed side",
  },
  {
    tone: "draw",
    label: "Blue",
    meaning: "Draw (1X2 only)",
  },
  {
    tone: "away",
    label: "Red",
    meaning: "Away team (1X2) or second listed side",
  },
  {
    tone: "over",
    label: "Teal",
    meaning: "Over the goals line (O/U markets)",
  },
  {
    tone: "under",
    label: "Rose",
    meaning: "Under the goals line (O/U markets)",
  },
  {
    tone: "yes",
    label: "Mint",
    meaning: "Yes — both teams score (BTTS)",
  },
  {
    tone: "no",
    label: "Coral",
    meaning: "No — not both teams score (BTTS)",
  },
];

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

export function legendToneClass(tone: OutcomeTone): string {
  return `legend-swatch--${tone}`;
}
