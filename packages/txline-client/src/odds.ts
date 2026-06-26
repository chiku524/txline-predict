/** Raw odds row from TxLINE `/api/odds/snapshot/{fixtureId}`. */
export interface TxLineRawOdds {
  FixtureId?: number;
  SuperOddsType?: string;
  MarketParameters?: string | null;
  MarketPeriod?: string | null;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
  Ts?: number;
}

export interface ParsedMatchOdds {
  homeImplied: number;
  drawImplied: number;
  awayImplied: number;
}

export interface ParsedTotalOdds {
  line: number;
  overImplied: number;
  underImplied: number;
}

export interface ParsedBttsOdds {
  yesImplied: number;
  noImplied: number;
}

function pctToProbability(pct: string[] | undefined, index: number): number | undefined {
  const raw = pct?.[index];
  if (!raw || raw === "NA") return undefined;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return undefined;
  return n / 100;
}

function priceToImplied(price: number | undefined): number | undefined {
  if (!price || price <= 0) return undefined;
  return 1 / (price / 1000);
}

function normalizePair(
  a: number | undefined,
  b: number | undefined
): [number, number] {
  const fallback = 0.5;
  const x = a ?? fallback;
  const y = b ?? fallback;
  const sum = x + y;
  return [x / sum, y / sum];
}

function normalizeTriple(
  a: number | undefined,
  b: number | undefined,
  c: number | undefined
): [number, number, number] {
  const x = a ?? 1 / 3;
  const y = b ?? 1 / 3;
  const z = c ?? 1 / 3;
  const sum = x + y + z;
  return [x / sum, y / sum, z / sum];
}

/** Full-match 1X2 odds (SuperOddsType `1X2_PARTICIPANT_RESULT`). */
export function parseMatchWinnerOdds(odds: TxLineRawOdds[]): ParsedMatchOdds | null {
  const row = odds.find(
    (o) =>
      o.SuperOddsType === "1X2_PARTICIPANT_RESULT" &&
      (o.MarketPeriod == null || o.MarketPeriod === "")
  );
  if (!row) return null;

  const [home, draw, away] = normalizeTriple(
    pctToProbability(row.Pct, 0) ?? priceToImplied(row.Prices?.[0]),
    pctToProbability(row.Pct, 1) ?? priceToImplied(row.Prices?.[1]),
    pctToProbability(row.Pct, 2) ?? priceToImplied(row.Prices?.[2])
  );

  return { homeImplied: home, drawImplied: draw, awayImplied: away };
}

/** Full-match over/under for a given line (default 2.5). */
export function parseTotalGoalsOdds(
  odds: TxLineRawOdds[],
  line = 2.5
): ParsedTotalOdds | null {
  const param = `line=${line}`;
  const row = odds.find(
    (o) =>
      o.SuperOddsType === "OVERUNDER_PARTICIPANT_GOALS" &&
      (o.MarketPeriod == null || o.MarketPeriod === "") &&
      o.MarketParameters === param
  );
  if (!row) return null;

  const [over, under] = normalizePair(
    priceToImplied(row.Prices?.[0]),
    priceToImplied(row.Prices?.[1])
  );

  return { line, overImplied: over, underImplied: under };
}

const BTTS_TYPES = new Set([
  "YESNO_PARTICIPANT_SCORES",
  "BTTS_PARTICIPANT_GOALS",
  "BOTH_PARTICIPANT_SCORE",
  "BOTH_TEAMS_TO_SCORE",
]);

function isBttsRow(o: TxLineRawOdds): boolean {
  const t = o.SuperOddsType ?? "";
  if (BTTS_TYPES.has(t)) return true;
  return /BTTS|BOTH.*SCORE/i.test(t);
}

/** Both teams to score (yes/no) for full match. */
export function parseBothTeamsScoreOdds(
  odds: TxLineRawOdds[]
): ParsedBttsOdds | null {
  const row = odds.find(
    (o) =>
      isBttsRow(o) && (o.MarketPeriod == null || o.MarketPeriod === "")
  );
  if (!row) return null;

  const [yes, no] = normalizePair(
    pctToProbability(row.Pct, 0) ?? priceToImplied(row.Prices?.[0]),
    pctToProbability(row.Pct, 1) ?? priceToImplied(row.Prices?.[1])
  );

  return { yesImplied: yes, noImplied: no };
}
