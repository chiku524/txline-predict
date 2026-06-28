import { TXLINE_MAINNET_API, TXLINE_DEV_API } from "./config";

export interface GuestAuthResponse {
  token: string;
}

export interface TokenActivationParams {
  txSig: string;
  walletSignature: string;
  leagues: number[];
  guestJwt: string;
}

let cachedGuest: { token: string; expiresAt: number; devnet: boolean } | null =
  null;

/** Guest JWTs are short-lived; cache per environment to avoid redundant auth calls. */
const GUEST_TTL_MS = 50 * 60 * 1000;

/** Start guest session — required alongside X-Api-Token on data requests. */
export async function startGuestSession(useDevnet = false): Promise<GuestAuthResponse> {
  const now = Date.now();
  if (
    cachedGuest &&
    cachedGuest.devnet === useDevnet &&
    cachedGuest.expiresAt > now
  ) {
    return { token: cachedGuest.token };
  }

  const base = useDevnet ? TXLINE_DEV_API : TXLINE_MAINNET_API;
  const res = await fetch(`${base}/auth/guest/start`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Guest auth failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as GuestAuthResponse;
  cachedGuest = {
    token: data.token,
    expiresAt: now + GUEST_TTL_MS,
    devnet: useDevnet,
  };
  return data;
}

/** Activate API token after on-chain subscription. */
export async function activateApiToken(
  params: TokenActivationParams
): Promise<string> {
  const res = await fetch(`${TXLINE_MAINNET_API}/api/token/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.guestJwt}`,
    },
    body: JSON.stringify({
      txSig: params.txSig,
      walletSignature: params.walletSignature,
      leagues: params.leagues,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token activation failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  return data.token ?? data;
}
