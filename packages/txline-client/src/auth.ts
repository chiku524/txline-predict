import { TXLINE_MAINNET_API } from "./config";

export interface GuestAuthResponse {
  token: string;
}

export interface TokenActivationParams {
  txSig: string;
  walletSignature: string;
  leagues: number[];
  guestJwt: string;
}

/** Start guest session — first step before on-chain subscribe + activation. */
export async function startGuestSession(): Promise<GuestAuthResponse> {
  const res = await fetch(`${TXLINE_MAINNET_API}/auth/guest/start`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Guest auth failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
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
