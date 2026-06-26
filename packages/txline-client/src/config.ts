import { startGuestSession } from "./auth";

export const TXLINE_MAINNET_API = "https://txline.txodds.com";
export const TXLINE_DEV_API = "https://txline-dev.txodds.com";

export const TXLINE_PROGRAM_MAINNET = "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA";
export const TXLINE_PROGRAM_DEVNET = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

export interface TxLineClientConfig {
  /** Activated API token from /api/token/activate */
  apiToken: string;
  /** Use devnet oracle for integration testing */
  useDevnet?: boolean;
}

export function getApiBaseUrl(useDevnet = false): string {
  return useDevnet ? TXLINE_DEV_API : TXLINE_MAINNET_API;
}

/** TxLINE requires guest JWT + X-Api-Token for subscribed data endpoints. */
export async function buildAuthHeaders(
  config: TxLineClientConfig
): Promise<HeadersInit> {
  const { token: jwt } = await startGuestSession(config.useDevnet);
  return {
    Authorization: `Bearer ${jwt}`,
    "X-Api-Token": config.apiToken,
    Accept: "application/json",
  };
}
