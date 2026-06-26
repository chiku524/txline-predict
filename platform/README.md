# Platform wallet (gitignored)

This folder holds the **dedicated platform Solana wallet** and TxLINE credentials.

| File | Purpose |
|------|---------|
| `platform-wallet.json` | Ed25519 secret key (Solana keypair array format) |
| `credentials.json` | TxLINE API token + subscription metadata (created by setup) |

## Generate wallet

```bash
npm run wallet:generate
```

## Activate TxLINE API (mainnet)

1. Fund the printed public key with **≥ 0.01 SOL** (mainnet fees only — free tier needs no TxL).
2. Run:

```bash
npm run txline:setup
```

This subscribes to World Cup free tier (service level 12, real-time) and writes `apps/web/.env.local`.

**Never commit** `platform-wallet.json` or `credentials.json`.
