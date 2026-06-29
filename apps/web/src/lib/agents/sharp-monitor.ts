import type {
  OddsSnapshotPoint,
  SharpMovementSignal,
} from "@txline-predict/txline-client";
import {
  buildMarketsFromFixtures,
  detectSharpMovements,
  fetchFixturesSnapshot,
  fetchOddsForFixtures,
  mapRawFixtures,
  snapshotsFromMarkets,
} from "@txline-predict/txline-client";

const apiToken = process.env.TXLINE_API_TOKEN ?? "";

interface MonitorState {
  lastPollAt: string | null;
  previousSnapshots: OddsSnapshotPoint[];
  signals: SharpMovementSignal[];
  pollCount: number;
}

const globalStore = globalThis as typeof globalThis & {
  __sharpMonitor?: MonitorState;
};

function store(): MonitorState {
  if (!globalStore.__sharpMonitor) {
    globalStore.__sharpMonitor = {
      lastPollAt: null,
      previousSnapshots: [],
      signals: [],
      pollCount: 0,
    };
  }
  return globalStore.__sharpMonitor;
}

export async function pollSharpMovements(): Promise<{
  signals: SharpMovementSignal[];
  lastPollAt: string | null;
  pollCount: number;
  marketsTracked: number;
  newSignals: number;
}> {
  if (!apiToken) {
    return {
      signals: store().signals,
      lastPollAt: store().lastPollAt,
      pollCount: store().pollCount,
      marketsTracked: 0,
      newSignals: 0,
    };
  }

  const state = store();
  const capturedAt = new Date().toISOString();

  const raw = await fetchFixturesSnapshot({ apiToken });
  const fixtures = mapRawFixtures(raw);
  const odds = await fetchOddsForFixtures(
    { apiToken },
    fixtures.map((f) => f.fixtureId)
  );
  const markets = buildMarketsFromFixtures(fixtures, odds);
  const currentSnapshots = snapshotsFromMarkets(markets, capturedAt);

  const newSignals =
    state.previousSnapshots.length > 0
      ? detectSharpMovements(
          state.previousSnapshots,
          currentSnapshots,
          markets
        )
      : [];

  if (newSignals.length > 0) {
    state.signals = [...newSignals, ...state.signals].slice(0, 100);
  }

  state.previousSnapshots = currentSnapshots;
  state.lastPollAt = capturedAt;
  state.pollCount += 1;

  return {
    signals: state.signals,
    lastPollAt: state.lastPollAt,
    pollCount: state.pollCount,
    marketsTracked: markets.length,
    newSignals: newSignals.length,
  };
}

export function getSharpMovementState() {
  const state = store();
  return {
    signals: state.signals,
    lastPollAt: state.lastPollAt,
    pollCount: state.pollCount,
  };
}
