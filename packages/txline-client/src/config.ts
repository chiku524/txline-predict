export const TXLINE_MAINNET_API = "https://txline.txodds.com";
export const TXLINE_ORACLE_API = "https://oracle.txodds.com/api";
export const TXLINE_DEV_ORACLE_API = "https://oracle-dev.txodds.com/api";

export const TXLINE_PROGRAM_MAINNET = "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA";
export const TXLINE_PROGRAM_DEVNET = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";

export interface TxLineClientConfig {
  /** Activated API token from /api/token/activate */
  apiToken: string;
  /** Use devnet oracle for integration testing */
  useDevnet?: boolean;
}

export function getOracleBaseUrl(useDevnet = false): string {
  return useDevnet ? TXLINE_DEV_ORACLE_API : TXLINE_ORACLE_API;
}
